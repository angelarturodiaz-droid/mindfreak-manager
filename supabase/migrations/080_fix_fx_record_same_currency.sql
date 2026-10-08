-- 080: Corrección urgente de las migraciones 076 y 077 (multimoneda V5).
--
-- Error reportado en la prueba AM (7-oct): al registrar un pago o cobro en
-- la MISMA moneda (pesos desde una cuenta en pesos) salía
--   record "v_fx" is not assigned yet
-- Causa: las funciones guardaban el resultado de fx_settlement en una
-- variable `record` que solo se llena en moneda diferente. Postgres necesita
-- conocer la estructura del record al planificar la instrucción, aunque la
-- rama del CASE no se use, así que fallaba siempre en la misma moneda (la
-- simulación no lo detectó porque los casos en otra moneda corrían antes
-- en la misma conexión).
-- Corrección: variables simples (v_fx_eff, v_fx_eff_cur, …) que siempre
-- existen. Misma lógica y mismas firmas: solo cambia cómo se guardan los
-- valores. Producción: 0 pagos/cobros en la misma moneda desde la 076 (el
-- error solo bloqueaba; no hay datos que corregir).
--
-- Funciones: register_supplier_payment, create_card_expense,
-- register_customer_payment. Idempotente. Aplicada en producción el 7-oct-2026.

create or replace function public.register_supplier_payment(
  p_company_id uuid,
  p_supplier_id uuid,
  p_expense_id uuid,
  p_project_id uuid,
  p_bank_account_id uuid,
  p_payment_date date,
  p_amount numeric,
  p_method text,
  p_reference text,
  p_currency text,
  p_exchange_rate numeric,
  p_notes text,
  p_payee_bank_name text,
  p_confirm_overdraft boolean,
  p_account_amount numeric default null,
  p_bank_fee numeric default null,
  p_reference_rate numeric default null,
  p_reference_rate_document numeric default null,
  p_reference_rate_source text default null,
  p_rate_date date default null,
  p_rate_manual_override boolean default false,
  p_rate_previous numeric default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment_id uuid;
  v_expense record;
  v_bank_account record;
  v_new_paid numeric;
  v_new_balance numeric;
  v_new_status text;
  v_user_id uuid := auth.uid();
  v_functional text;
  v_tolerance numeric;
  v_multi boolean;
  -- Variables simples (no un record): un record sin asignar hace fallar
  -- los pagos en la misma moneda ("record v_fx is not assigned yet").
  v_fx_eff numeric;
  v_fx_eff_cur text;
  v_fx_func numeric;
  v_fx_round numeric;
  v_fx_info numeric;
  v_fx_acc numeric;
  v_bank_amount numeric;
  v_bank_rate numeric;
  v_functional_amount numeric;
  v_fee numeric := coalesce(p_bank_fee, 0);
begin
  if not public.has_permission('payments.create') then
    raise exception 'insufficient_privilege: falta el permiso payments.create';
  end if;

  if p_company_id not in (select * from public.user_company_ids()) then
    raise exception 'company_mismatch: no tienes acceso a esta compañía';
  end if;

  if p_bank_account_id is null then
    raise exception 'bank_account_required: debes elegir la cuenta bancaria desde donde se realizó el pago';
  end if;

  select * into v_expense from public.expenses where id = p_expense_id for update;
  if not found then
    raise exception 'expense_not_found: el gasto % no existe', p_expense_id;
  end if;
  if v_expense.company_id <> p_company_id then
    raise exception 'company_mismatch: el gasto no pertenece a esta compañía';
  end if;
  if v_expense.status not in ('PENDING', 'PARTIALLY_PAID') then
    raise exception 'invalid_status: solo se puede pagar un gasto pendiente (estado actual: %)', v_expense.status;
  end if;
  if p_amount <= 0 then
    raise exception 'invalid_amount: el monto debe ser mayor a 0';
  end if;
  if p_amount > v_expense.balance then
    raise exception 'amount_exceeds_balance: el monto (%) supera lo pendiente por pagarle al proveedor (%)', p_amount, v_expense.balance;
  end if;
  if v_fee < 0 then
    raise exception 'invalid_amount: la comisión no puede ser negativa';
  end if;

  select * into v_bank_account from public.bank_accounts where id = p_bank_account_id;
  if not found or v_bank_account.company_id <> p_company_id then
    raise exception 'account_not_found: la cuenta bancaria no existe o no pertenece a esta compañía';
  end if;
  if v_bank_account.type = 'CREDIT_CARD' then
    raise exception 'invalid_account_type: un gasto pagado con tarjeta se registra directo como tarjeta al crearlo, no como pago posterior';
  end if;

  select c.base_currency into v_functional from public.companies c where c.id = p_company_id;
  select s.rounding_tolerance into v_tolerance from public.currency_settings s where s.company_id = p_company_id;
  v_tolerance := coalesce(v_tolerance, 1);
  v_multi := v_bank_account.currency <> v_expense.currency;

  if v_multi then
    select f.effective_rate, f.effective_rate_currency, f.functional_amount, f.rounding_difference, f.informative_difference, f.account_rate
      into v_fx_eff, v_fx_eff_cur, v_fx_func, v_fx_round, v_fx_info, v_fx_acc
      from public.fx_settlement('PAGO', v_expense.currency, v_bank_account.currency, v_functional,
      p_amount, p_account_amount, p_reference_rate, p_reference_rate_document, v_tolerance) f;
    v_bank_amount := p_account_amount;
    v_bank_rate := v_fx_acc;
    v_functional_amount := v_fx_func;
  else
    v_bank_amount := p_amount;
    v_bank_rate := coalesce(p_exchange_rate, 1);
    v_functional_amount := case
      when v_bank_account.currency = v_functional then p_amount
      when coalesce(p_reference_rate, 0) > 0 then round(p_amount * p_reference_rate, 2)
      else round(p_amount * coalesce(p_exchange_rate, 1), 2)
    end;
  end if;

  insert into public.supplier_payments (
    company_id, supplier_id, expense_id, project_id, bank_account_id,
    payment_date, amount, method, reference, currency, exchange_rate, notes,
    payee_bank_name, created_by,
    account_currency, account_amount, bank_fee_amount, functional_currency, functional_amount,
    effective_rate, effective_rate_currency, reference_rate, reference_rate_document,
    reference_rate_source, rate_date, rate_manual_override, rate_overridden_by, rate_previous,
    rounding_difference, informative_difference
  ) values (
    p_company_id, p_supplier_id, p_expense_id, p_project_id, p_bank_account_id,
    p_payment_date, p_amount, p_method, p_reference, v_expense.currency, v_expense.exchange_rate, p_notes,
    p_payee_bank_name, v_user_id,
    v_bank_account.currency, v_bank_amount, nullif(v_fee, 0), v_functional, v_functional_amount,
    case when v_multi then v_fx_eff end,
    case when v_multi then v_fx_eff_cur end,
    p_reference_rate, p_reference_rate_document,
    p_reference_rate_source, coalesce(p_rate_date, case when v_multi then p_payment_date end),
    coalesce(p_rate_manual_override, false),
    case when coalesce(p_rate_manual_override, false) then v_user_id end,
    p_rate_previous,
    case when v_multi then v_fx_round else 0 end,
    case when v_multi then v_fx_info else 0 end
  )
  returning id into v_payment_id;

  v_new_paid := v_expense.paid_amount + p_amount;
  -- Con retenciones el proveedor recibe el neto; sin retención net_payable = total.
  v_new_balance := coalesce(v_expense.net_payable, v_expense.total) - v_new_paid;
  v_new_status := case
    when v_new_balance <= 0 then 'PAID'
    else 'PARTIALLY_PAID'
  end;

  update public.expenses
  set paid_amount = v_new_paid,
      balance = greatest(0, v_new_balance),
      status = v_new_status
  where id = p_expense_id;

  -- El banco se mueve SOLO en la moneda de la cuenta (regla de oro).
  insert into public.bank_transactions (
    company_id, bank_account_id, project_id, supplier_id, supplier_payment_id,
    type, amount, currency, exchange_rate, transaction_date, description,
    overdraft_confirmed
  ) values (
    p_company_id, p_bank_account_id, p_project_id, p_supplier_id, v_payment_id,
    'EXPENSE', v_bank_amount, v_bank_account.currency, v_bank_rate, p_payment_date,
    'Pago a proveedor — gasto: ' || v_expense.description,
    coalesce(p_confirm_overdraft, false)
  );

  -- Comisión del banco: movimiento aparte, nunca cambia lo aplicado al gasto.
  if v_fee > 0 then
    insert into public.bank_transactions (
      company_id, bank_account_id, project_id, supplier_id,
      type, amount, currency, exchange_rate, transaction_date, description,
      category_id, system_concept, related_source_type, related_source_id, overdraft_confirmed
    ) values (
      p_company_id, p_bank_account_id, p_project_id, p_supplier_id,
      'EXPENSE', v_fee, v_bank_account.currency, v_bank_rate, p_payment_date,
      'Comisión bancaria — pago a proveedor: ' || v_expense.description,
      public.find_expense_category(p_company_id, 'Comisiones bancarias'),
      'BANK_FEE', 'supplier_payment', v_payment_id,
      coalesce(p_confirm_overdraft, false)
    );
  end if;

  insert into public.audit_logs (company_id, user_id, action, entity_type, entity_id, new_values)
  values (
    p_company_id, v_user_id, 'CREATE', 'supplier_payment', v_payment_id,
    jsonb_build_object(
      'expense_id', p_expense_id, 'amount', p_amount, 'method', p_method,
      'new_expense_status', v_new_status, 'payee_bank_name', p_payee_bank_name,
      'overdraft_confirmed', coalesce(p_confirm_overdraft, false),
      'net_payable', coalesce(v_expense.net_payable, v_expense.total),
      'total_withheld', v_expense.total_withheld,
      'account_currency', v_bank_account.currency, 'account_amount', v_bank_amount,
      'bank_fee', v_fee, 'reference_rate', p_reference_rate,
      'reference_rate_document', p_reference_rate_document,
      'reference_rate_source', p_reference_rate_source,
      'rate_manual_override', coalesce(p_rate_manual_override, false), 'rate_previous', p_rate_previous,
      'effective_rate', case when v_multi then v_fx_eff end,
      'rounding_difference', case when v_multi then v_fx_round else 0 end,
      'informative_difference', case when v_multi then v_fx_info else 0 end
    )
  );

  return v_payment_id;
end;
$$;

create or replace function public.create_card_expense(
  p_company_id uuid,
  p_category_id uuid,
  p_supplier_id uuid,
  p_project_id uuid,
  p_card_account_id uuid,
  p_expense_date date,
  p_description text,
  p_subtotal numeric,
  p_tax numeric,
  p_total numeric,
  p_currency text,
  p_exchange_rate numeric,
  p_payment_method text,
  p_payee_bank_name text,
  p_confirm_overdraft boolean,
  p_fiscal jsonb,
  p_account_amount numeric default null,
  p_bank_fee numeric default null,
  p_reference_rate numeric default null,
  p_reference_rate_document numeric default null,
  p_reference_rate_source text default null,
  p_rate_date date default null,
  p_rate_manual_override boolean default false,
  p_rate_previous numeric default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expense_id uuid;
  v_payment_id uuid;
  v_account record;
  v_user_id uuid := auth.uid();
  v_net numeric;
  v_withheld numeric;
  v_functional text;
  v_tolerance numeric;
  v_multi boolean;
  -- Variables simples (no un record): un record sin asignar hace fallar
  -- los pagos en la misma moneda ("record v_fx is not assigned yet").
  v_fx_eff numeric;
  v_fx_eff_cur text;
  v_fx_func numeric;
  v_fx_round numeric;
  v_fx_info numeric;
  v_fx_acc numeric;
  v_bank_amount numeric;
  v_bank_rate numeric;
  v_functional_amount numeric;
  v_fee numeric := coalesce(p_bank_fee, 0);
begin
  if not public.has_permission('expenses.create') then
    raise exception 'insufficient_privilege: falta el permiso expenses.create';
  end if;

  if p_company_id not in (select * from public.user_company_ids()) then
    raise exception 'company_mismatch: no tienes acceso a esta compañía';
  end if;

  if p_total <= 0 then
    raise exception 'invalid_amount: el total debe ser mayor a 0';
  end if;
  if v_fee < 0 then
    raise exception 'invalid_amount: la comisión no puede ser negativa';
  end if;

  v_withheld := coalesce((p_fiscal->>'total_withheld')::numeric, 0);
  v_net := coalesce((p_fiscal->>'net_payable')::numeric, p_total);
  if v_withheld < 0 or v_net < 0 or v_net > p_total or abs((p_total - v_withheld) - v_net) > 0.01 then
    raise exception 'invalid_fiscal: el neto a pagar no cuadra con el total y las retenciones';
  end if;

  select * into v_account from public.bank_accounts where id = p_card_account_id;
  if not found or v_account.company_id <> p_company_id then
    raise exception 'account_not_found: la cuenta no existe o no pertenece a esta compañía';
  end if;
  if not v_account.is_active then
    raise exception 'inactive_account: la cuenta está inactiva';
  end if;

  select c.base_currency into v_functional from public.companies c where c.id = p_company_id;
  select s.rounding_tolerance into v_tolerance from public.currency_settings s where s.company_id = p_company_id;
  v_tolerance := coalesce(v_tolerance, 1);
  v_multi := v_account.currency <> p_currency;

  if v_net > 0 then
    if v_multi then
      select f.effective_rate, f.effective_rate_currency, f.functional_amount, f.rounding_difference, f.informative_difference, f.account_rate
      into v_fx_eff, v_fx_eff_cur, v_fx_func, v_fx_round, v_fx_info, v_fx_acc
      from public.fx_settlement('PAGO', p_currency, v_account.currency, v_functional,
        v_net, p_account_amount, p_reference_rate, p_reference_rate_document, v_tolerance) f;
      v_bank_amount := p_account_amount;
      v_bank_rate := v_fx_acc;
      v_functional_amount := v_fx_func;
    else
      v_bank_amount := v_net;
      v_bank_rate := coalesce(p_exchange_rate, 1);
      v_functional_amount := case
        when v_account.currency = v_functional then v_net
        when coalesce(p_reference_rate, 0) > 0 then round(v_net * p_reference_rate, 2)
        else round(v_net * coalesce(p_exchange_rate, 1), 2)
      end;
    end if;
  end if;

  insert into public.expenses (
    company_id, category_id, supplier_id, project_id, bank_account_id,
    expense_date, description, subtotal, tax, total, paid_amount, balance,
    payment_method, status, currency, exchange_rate, payee_bank_name, created_by,
    service_type_id, document_type, ncf, operation_type, fiscal_status, fiscal_rule_id,
    fiscal_rule_version, isr_rate, isr_base_pct, itbis_retention_pct, isr_withheld,
    itbis_withheld, total_withheld, net_payable, fiscal_evaluated_at, fiscal_snapshot
  ) values (
    p_company_id, p_category_id, p_supplier_id, p_project_id, p_card_account_id,
    p_expense_date, p_description, p_subtotal, p_tax, p_total, v_net, 0,
    p_payment_method, 'PAID', p_currency, p_exchange_rate, p_payee_bank_name, v_user_id,
    nullif(p_fiscal->>'service_type_id', '')::uuid,
    nullif(p_fiscal->>'document_type', ''),
    nullif(p_fiscal->>'ncf', ''),
    nullif(p_fiscal->>'operation_type', ''),
    coalesce(nullif(p_fiscal->>'fiscal_status', ''), 'NOT_EVALUATED'),
    nullif(p_fiscal->>'fiscal_rule_id', '')::uuid,
    nullif(p_fiscal->>'fiscal_rule_version', '')::integer,
    coalesce((p_fiscal->>'isr_rate')::numeric, 0),
    coalesce((p_fiscal->>'isr_base_pct')::numeric, 100),
    coalesce((p_fiscal->>'itbis_retention_pct')::numeric, 0),
    coalesce((p_fiscal->>'isr_withheld')::numeric, 0),
    coalesce((p_fiscal->>'itbis_withheld')::numeric, 0),
    v_withheld,
    v_net,
    case when p_fiscal is null then null else now() end,
    p_fiscal->'snapshot'
  )
  returning id into v_expense_id;

  -- Si todo se retuvo (neto 0) no sale dinero hacia el proveedor.
  if v_net > 0 then
    if p_supplier_id is not null then
      insert into public.supplier_payments (
        company_id, supplier_id, expense_id, project_id, bank_account_id,
        payment_date, amount, method, currency, exchange_rate,
        payee_bank_name, created_by,
        account_currency, account_amount, bank_fee_amount, functional_currency, functional_amount,
        effective_rate, effective_rate_currency, reference_rate, reference_rate_document,
        reference_rate_source, rate_date, rate_manual_override, rate_overridden_by, rate_previous,
        rounding_difference, informative_difference
      ) values (
        p_company_id, p_supplier_id, v_expense_id, p_project_id, p_card_account_id,
        p_expense_date, v_net, p_payment_method, p_currency, p_exchange_rate,
        p_payee_bank_name, v_user_id,
        v_account.currency, v_bank_amount, nullif(v_fee, 0), v_functional, v_functional_amount,
        case when v_multi then v_fx_eff end,
        case when v_multi then v_fx_eff_cur end,
        p_reference_rate, p_reference_rate_document,
        p_reference_rate_source, coalesce(p_rate_date, case when v_multi then p_expense_date end),
        coalesce(p_rate_manual_override, false),
        case when coalesce(p_rate_manual_override, false) then v_user_id end,
        p_rate_previous,
        case when v_multi then v_fx_round else 0 end,
        case when v_multi then v_fx_info else 0 end
      )
      returning id into v_payment_id;
    end if;

    insert into public.bank_transactions (
      company_id, bank_account_id, project_id, supplier_id, expense_id, supplier_payment_id,
      type, amount, currency, exchange_rate, transaction_date, description,
      overdraft_confirmed
    ) values (
      p_company_id, p_card_account_id, p_project_id, p_supplier_id, v_expense_id, v_payment_id,
      'EXPENSE', v_bank_amount, v_account.currency, v_bank_rate, p_expense_date,
      case when v_account.type = 'CREDIT_CARD' then 'Compra con tarjeta: ' else 'Gasto pagado: ' end
        || p_description,
      coalesce(p_confirm_overdraft, false)
    );

    if v_fee > 0 then
      insert into public.bank_transactions (
        company_id, bank_account_id, project_id, supplier_id, expense_id,
        type, amount, currency, exchange_rate, transaction_date, description,
        category_id, system_concept, related_source_type, related_source_id, overdraft_confirmed
      ) values (
        p_company_id, p_card_account_id, p_project_id, p_supplier_id, null,
        'EXPENSE', v_fee, v_account.currency, v_bank_rate, p_expense_date,
        'Comisión bancaria — ' || p_description,
        public.find_expense_category(p_company_id, 'Comisiones bancarias'),
        'BANK_FEE', case when v_payment_id is not null then 'supplier_payment' end, v_payment_id,
        coalesce(p_confirm_overdraft, false)
      );
    end if;
  end if;

  insert into public.audit_logs (company_id, user_id, action, entity_type, entity_id, new_values)
  values (
    p_company_id, v_user_id, 'CREATE', 'expense', v_expense_id,
    jsonb_build_object(
      'description', p_description, 'total', p_total, 'net_payable', v_net,
      'total_withheld', v_withheld, 'fiscal_status', p_fiscal->>'fiscal_status',
      'account_id', p_card_account_id, 'account_type', v_account.type,
      'payment_method', p_payment_method, 'payee_bank_name', p_payee_bank_name,
      'overdraft_confirmed', coalesce(p_confirm_overdraft, false),
      'account_currency', v_account.currency, 'account_amount', v_bank_amount,
      'bank_fee', v_fee, 'reference_rate', p_reference_rate,
      'reference_rate_document', p_reference_rate_document,
      'rate_manual_override', coalesce(p_rate_manual_override, false),
      'effective_rate', case when v_multi and v_net > 0 then v_fx_eff end,
      'informative_difference', case when v_multi and v_net > 0 then v_fx_info else 0 end
    )
  );

  return v_expense_id;
end;
$$;

create or replace function public.register_customer_payment(
  p_company_id uuid,
  p_client_id uuid,
  p_invoice_id uuid,
  p_project_id uuid,
  p_bank_account_id uuid,
  p_payment_date date,
  p_amount numeric,
  p_method text,
  p_reference text,
  p_currency text,
  p_exchange_rate numeric,
  p_notes text,
  p_category_id uuid,
  p_account_amount numeric default null,
  p_bank_fee numeric default null,
  p_reference_rate numeric default null,
  p_reference_rate_document numeric default null,
  p_reference_rate_source text default null,
  p_rate_date date default null,
  p_rate_manual_override boolean default false,
  p_rate_previous numeric default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment_id uuid;
  v_invoice record;
  v_bank_account record;
  v_new_paid numeric;
  v_new_balance numeric;
  v_new_status text;
  v_user_id uuid := auth.uid();
  v_functional text;
  v_tolerance numeric;
  v_multi boolean;
  -- Variables simples (no un record): un record sin asignar hace fallar
  -- los pagos en la misma moneda ("record v_fx is not assigned yet").
  v_fx_eff numeric;
  v_fx_eff_cur text;
  v_fx_func numeric;
  v_fx_round numeric;
  v_fx_info numeric;
  v_fx_acc numeric;
  v_bank_amount numeric;
  v_bank_rate numeric;
  v_functional_amount numeric;
  v_fee numeric := coalesce(p_bank_fee, 0);
begin
  if not public.has_permission('payments.create') then
    raise exception 'insufficient_privilege: falta el permiso payments.create';
  end if;

  if p_company_id not in (select * from public.user_company_ids()) then
    raise exception 'company_mismatch: no tienes acceso a esta compañía';
  end if;

  if p_bank_account_id is null then
    raise exception 'bank_account_required: debes elegir la cuenta bancaria donde se recibió el cobro';
  end if;

  if p_category_id is not null and not exists (
    select 1 from public.expense_categories
    where id = p_category_id and company_id = p_company_id
  ) then
    raise exception 'category_not_found: la categoría no existe o no pertenece a esta compañía';
  end if;

  select * into v_invoice from public.invoices where id = p_invoice_id for update;
  if not found then
    raise exception 'invoice_not_found: la factura % no existe', p_invoice_id;
  end if;
  if v_invoice.company_id <> p_company_id then
    raise exception 'company_mismatch: la factura no pertenece a esta compañía';
  end if;
  if p_client_id is distinct from v_invoice.client_id then
    raise exception 'client_mismatch: el cliente del cobro no es el cliente de la factura';
  end if;
  if v_invoice.status not in ('ISSUED', 'PARTIALLY_PAID', 'OVERDUE') then
    raise exception 'invalid_status: solo se puede cobrar una factura emitida (estado actual: %)', v_invoice.status;
  end if;
  if p_amount <= 0 then
    raise exception 'invalid_amount: el monto debe ser mayor a 0';
  end if;
  if p_amount > v_invoice.balance then
    raise exception 'amount_exceeds_balance: el monto (%) supera el balance pendiente (%)', p_amount, v_invoice.balance;
  end if;
  if v_fee < 0 then
    raise exception 'invalid_amount: la comisión no puede ser negativa';
  end if;

  select * into v_bank_account from public.bank_accounts where id = p_bank_account_id;
  if not found or v_bank_account.company_id <> p_company_id then
    raise exception 'account_not_found: la cuenta bancaria no existe o no pertenece a esta compañía';
  end if;
  if v_bank_account.type = 'CREDIT_CARD' then
    raise exception 'invalid_account_type: no se puede recibir un cobro de cliente en una tarjeta de crédito';
  end if;

  select c.base_currency into v_functional from public.companies c where c.id = p_company_id;
  select s.rounding_tolerance into v_tolerance from public.currency_settings s where s.company_id = p_company_id;
  v_tolerance := coalesce(v_tolerance, 1);
  v_multi := v_bank_account.currency <> v_invoice.currency;

  if v_multi then
    select f.effective_rate, f.effective_rate_currency, f.functional_amount, f.rounding_difference, f.informative_difference, f.account_rate
      into v_fx_eff, v_fx_eff_cur, v_fx_func, v_fx_round, v_fx_info, v_fx_acc
      from public.fx_settlement('COBRO', v_invoice.currency, v_bank_account.currency, v_functional,
      p_amount, p_account_amount, p_reference_rate, p_reference_rate_document, v_tolerance) f;
    v_bank_amount := p_account_amount;
    v_bank_rate := v_fx_acc;
    v_functional_amount := v_fx_func;
  else
    if p_account_amount is not null and p_account_amount <> p_amount then
      raise exception 'invalid_amount: misma moneda, el monto del banco debe ser igual al cobrado';
    end if;
    v_bank_amount := p_amount;
    v_bank_rate := coalesce(p_exchange_rate, 1);
    v_functional_amount := case
      when v_bank_account.currency = v_functional then p_amount
      when coalesce(p_reference_rate, 0) > 0 then round(p_amount * p_reference_rate, 2)
      else round(p_amount * coalesce(p_exchange_rate, 1), 2)
    end;
  end if;

  if v_fee >= v_bank_amount then
    raise exception 'invalid_amount: la comisión no puede ser igual o mayor que lo que entró al banco';
  end if;

  insert into public.customer_payments (
    company_id, client_id, invoice_id, project_id, bank_account_id,
    payment_date, amount, method, reference, currency, exchange_rate, notes,
    created_by,
    account_currency, account_amount, bank_fee_amount, functional_currency, functional_amount,
    effective_rate, effective_rate_currency, reference_rate, reference_rate_document,
    reference_rate_source, rate_date, rate_manual_override, rate_overridden_by, rate_previous,
    rounding_difference, informative_difference
  ) values (
    p_company_id, p_client_id, p_invoice_id, p_project_id, p_bank_account_id,
    p_payment_date, p_amount, p_method, p_reference, v_invoice.currency, coalesce(p_exchange_rate, v_invoice.exchange_rate), p_notes,
    v_user_id,
    v_bank_account.currency, v_bank_amount, nullif(v_fee, 0), v_functional, v_functional_amount,
    case when v_multi then v_fx_eff end,
    case when v_multi then v_fx_eff_cur end,
    p_reference_rate, p_reference_rate_document,
    p_reference_rate_source, coalesce(p_rate_date, case when v_multi then p_payment_date end),
    coalesce(p_rate_manual_override, false),
    case when coalesce(p_rate_manual_override, false) then v_user_id end,
    p_rate_previous,
    case when v_multi then v_fx_round else 0 end,
    case when v_multi then v_fx_info else 0 end
  )
  returning id into v_payment_id;

  v_new_paid := v_invoice.paid_amount + p_amount;
  v_new_balance := v_invoice.total - v_new_paid;
  v_new_status := case
    when v_new_balance <= 0 then 'PAID'
    else 'PARTIALLY_PAID'
  end;

  update public.invoices
  set paid_amount = v_new_paid,
      balance = greatest(0, v_new_balance),
      status = v_new_status
  where id = p_invoice_id;

  -- El banco se mueve SOLO en la moneda de la cuenta (regla de oro).
  -- category_id null -> el trigger asigna "Cobro de factura".
  insert into public.bank_transactions (
    company_id, bank_account_id, project_id, client_id, customer_payment_id,
    type, amount, currency, exchange_rate, transaction_date, description,
    category_id
  ) values (
    p_company_id, p_bank_account_id, p_project_id, p_client_id, v_payment_id,
    'INCOME', v_bank_amount, v_bank_account.currency, v_bank_rate, p_payment_date,
    'Cobro factura ' || v_invoice.number,
    p_category_id
  );

  -- Comisión del banco por recibir el dinero: movimiento aparte.
  if v_fee > 0 then
    insert into public.bank_transactions (
      company_id, bank_account_id, project_id, client_id,
      type, amount, currency, exchange_rate, transaction_date, description,
      category_id, system_concept, related_source_type, related_source_id, overdraft_confirmed
    ) values (
      p_company_id, p_bank_account_id, p_project_id, p_client_id,
      'EXPENSE', v_fee, v_bank_account.currency, v_bank_rate, p_payment_date,
      'Comisión bancaria — cobro factura ' || v_invoice.number,
      public.find_expense_category(p_company_id, 'Comisiones bancarias'),
      'BANK_FEE', 'customer_payment', v_payment_id,
      -- La comisión es menor que lo que acaba de entrar: el cobro neto nunca
      -- deja la cuenta más baja que antes, así que no es un sobregiro nuevo.
      true
    );
  end if;

  insert into public.audit_logs (company_id, user_id, action, entity_type, entity_id, new_values)
  values (
    p_company_id, v_user_id, 'CREATE', 'customer_payment', v_payment_id,
    jsonb_build_object(
      'invoice_id', p_invoice_id, 'amount', p_amount, 'method', p_method,
      'new_invoice_status', v_new_status, 'category_id', p_category_id,
      'account_currency', v_bank_account.currency, 'account_amount', v_bank_amount,
      'bank_fee', v_fee, 'reference_rate', p_reference_rate,
      'reference_rate_document', p_reference_rate_document,
      'reference_rate_source', p_reference_rate_source,
      'rate_manual_override', coalesce(p_rate_manual_override, false), 'rate_previous', p_rate_previous,
      'effective_rate', case when v_multi then v_fx_eff end,
      'rounding_difference', case when v_multi then v_fx_round else 0 end,
      'informative_difference', case when v_multi then v_fx_info else 0 end
    )
  );

  return v_payment_id;
end;
$$;
