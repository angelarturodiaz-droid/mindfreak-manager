-- 076: Multimoneda operacional V5 — paso 2: pagos a proveedores (y gasto
-- pagado al crearlo) desde una cuenta en moneda diferente
-- (claude/propuesta-multimoneda-pagos.md, secciones 2–5).
--
-- * supplier_payments: columnas nuevas, todas opcionales (los pagos
--   históricos no se tocan). `amount` sigue siendo el MONTO APLICADO al
--   gasto (moneda del gasto) y `currency` la moneda del gasto.
-- * bank_transactions: `system_concept` (BANK_FEE) y relación opcional con
--   la operación de origen (comisión ligada al pago).
-- * fx_settlement(): la fórmula única (tasa efectiva, equivalente funcional,
--   redondeo y diferencia informativa). Igual a features/currencies/fx.ts.
-- * register_supplier_payment y create_card_expense: parámetros opcionales
--   nuevos. Misma moneda → igual que antes. Moneda diferente → exige el
--   monto real del banco y la tasa de referencia; el movimiento de banco va
--   en la moneda de la cuenta; la comisión es un movimiento aparte.
--   La parte fiscal (neto, retenciones, estados) no cambia.
--
-- Idempotente. Aplicada en producción el 5-oct-2026.

-- 1) Columnas nuevas en pagos a proveedores
alter table public.supplier_payments
  add column if not exists account_currency text,
  add column if not exists account_amount numeric(14, 2) check (account_amount is null or account_amount > 0),
  add column if not exists bank_fee_amount numeric(14, 2) check (bank_fee_amount is null or bank_fee_amount >= 0),
  add column if not exists functional_currency text,
  add column if not exists functional_amount numeric(14, 2),
  add column if not exists effective_rate numeric(18, 6),
  add column if not exists effective_rate_currency text,
  add column if not exists reference_rate numeric(18, 6),
  add column if not exists reference_rate_document numeric(18, 6),
  add column if not exists reference_rate_source text,
  add column if not exists rate_date date,
  add column if not exists rate_manual_override boolean not null default false,
  add column if not exists rate_overridden_by uuid references public.profiles (id) on delete set null,
  add column if not exists rate_previous numeric(18, 6),
  add column if not exists rounding_difference numeric(14, 2) not null default 0,
  add column if not exists informative_difference numeric(14, 2) not null default 0;

-- 2) Movimientos del sistema (comisión) y relación con la operación de origen
alter table public.bank_transactions
  add column if not exists system_concept text check (system_concept is null or system_concept in ('BANK_FEE')),
  add column if not exists related_source_type text
    check (related_source_type is null or related_source_type in ('supplier_payment', 'customer_payment', 'bank_transfer')),
  add column if not exists related_source_id uuid;
create index if not exists idx_bank_transactions_related on public.bank_transactions (related_source_type, related_source_id)
  where related_source_id is not null;

-- 3) Fórmula única de la operación en moneda diferente
create or replace function public.fx_settlement(
  p_kind text,                 -- 'PAGO' | 'COBRO'
  p_document_currency text,
  p_account_currency text,
  p_functional_currency text,
  p_applied numeric,           -- monto aplicado al documento (su moneda)
  p_account_amount numeric,    -- monto real del banco (moneda de la cuenta, sin comisión)
  p_reference_rate numeric,    -- tasa de referencia de la moneda de la cuenta
  p_reference_rate_document numeric, -- tasa de referencia de la moneda del documento (si es extranjera y distinta)
  p_tolerance numeric
)
returns table (
  effective_rate numeric,
  effective_rate_currency text,
  functional_amount numeric,
  rounding_difference numeric,
  informative_difference numeric,
  account_rate numeric
)
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_acc_rate numeric;
  v_doc_rate numeric;
  v_func_bank numeric;
  v_func_applied numeric;
  v_diff numeric;
begin
  if p_document_currency = p_account_currency then
    raise exception 'fx_same_currency: el documento y la cuenta están en la misma moneda';
  end if;
  if coalesce(p_account_amount, 0) <= 0 then
    raise exception 'account_amount_required: Indica cuánto debitó realmente el banco (en %).', p_account_currency;
  end if;
  if coalesce(p_applied, 0) <= 0 then
    raise exception 'invalid_amount: el monto aplicado debe ser mayor a 0';
  end if;

  if p_account_currency = p_functional_currency then
    v_acc_rate := 1;
  elsif coalesce(p_reference_rate, 0) > 0 then
    v_acc_rate := p_reference_rate;
  else
    raise exception 'reference_rate_required: Falta la tasa de referencia de % (cuántos % vale 1 %).', p_account_currency, p_functional_currency, p_account_currency;
  end if;

  if p_document_currency = p_functional_currency then
    v_doc_rate := 1;
  elsif coalesce(p_reference_rate_document, 0) > 0 then
    v_doc_rate := p_reference_rate_document;
  else
    raise exception 'reference_rate_required: Falta la tasa de referencia de % (cuántos % vale 1 %).', p_document_currency, p_functional_currency, p_document_currency;
  end if;

  if p_account_currency <> p_functional_currency then
    effective_rate_currency := p_account_currency;
    effective_rate := round(p_applied * v_doc_rate / p_account_amount, 6);
  else
    effective_rate_currency := p_document_currency;
    effective_rate := round(p_account_amount / p_applied, 6);
  end if;

  v_func_bank := round(p_account_amount * v_acc_rate, 2);
  v_func_applied := round(p_applied * v_doc_rate, 2);
  v_diff := case when p_kind = 'COBRO' then v_func_applied - v_func_bank else v_func_bank - v_func_applied end;

  functional_amount := v_func_bank;
  account_rate := v_acc_rate;
  if abs(v_diff) <= coalesce(p_tolerance, 0) then
    rounding_difference := v_diff;
    informative_difference := 0;
  else
    rounding_difference := 0;
    informative_difference := v_diff;
  end if;
  return next;
end;
$$;

-- 4) Pago a proveedor (reemplaza la versión de la migración 074)
-- La versión anterior (14 parámetros) se RENOMBRA en vez de borrarse
-- (Supabase pide confirmación para borrar funciones) y queda sin permisos.
-- Se puede borrar después desde el SQL Editor (ver final del archivo).
do $do$
begin
  if to_regprocedure('public.register_supplier_payment(uuid, uuid, uuid, uuid, uuid, date, numeric, text, text, text, numeric, text, text, boolean)') is not null then
    alter function public.register_supplier_payment(uuid, uuid, uuid, uuid, uuid, date, numeric, text, text, text, numeric, text, text, boolean)
      rename to register_supplier_payment_old_074;
    revoke all on function public.register_supplier_payment_old_074(uuid, uuid, uuid, uuid, uuid, date, numeric, text, text, text, numeric, text, text, boolean)
      from public, anon, authenticated;
  end if;
end
$do$;

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
  v_fx record;
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
    select * into v_fx from public.fx_settlement('PAGO', v_expense.currency, v_bank_account.currency, v_functional,
      p_amount, p_account_amount, p_reference_rate, p_reference_rate_document, v_tolerance);
    v_bank_amount := p_account_amount;
    v_bank_rate := v_fx.account_rate;
    v_functional_amount := v_fx.functional_amount;
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
    case when v_multi then v_fx.effective_rate end,
    case when v_multi then v_fx.effective_rate_currency end,
    p_reference_rate, p_reference_rate_document,
    p_reference_rate_source, coalesce(p_rate_date, case when v_multi then p_payment_date end),
    coalesce(p_rate_manual_override, false),
    case when coalesce(p_rate_manual_override, false) then v_user_id end,
    p_rate_previous,
    case when v_multi then v_fx.rounding_difference else 0 end,
    case when v_multi then v_fx.informative_difference else 0 end
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
      'effective_rate', case when v_multi then v_fx.effective_rate end,
      'rounding_difference', case when v_multi then v_fx.rounding_difference else 0 end,
      'informative_difference', case when v_multi then v_fx.informative_difference else 0 end
    )
  );

  return v_payment_id;
end;
$$;

revoke all on function public.register_supplier_payment(uuid, uuid, uuid, uuid, uuid, date, numeric, text, text, text, numeric, text, text, boolean, numeric, numeric, numeric, numeric, text, date, boolean, numeric) from public, anon;
grant execute on function public.register_supplier_payment(uuid, uuid, uuid, uuid, uuid, date, numeric, text, text, text, numeric, text, text, boolean, numeric, numeric, numeric, numeric, text, date, boolean, numeric) to authenticated, service_role;

-- 5) Gasto pagado al crearlo (reemplaza la versión de la migración 074)
do $do$
begin
  if to_regprocedure('public.create_card_expense(uuid, uuid, uuid, uuid, uuid, date, text, numeric, numeric, numeric, text, numeric, text, text, boolean, jsonb)') is not null then
    alter function public.create_card_expense(uuid, uuid, uuid, uuid, uuid, date, text, numeric, numeric, numeric, text, numeric, text, text, boolean, jsonb)
      rename to create_card_expense_old_074;
    revoke all on function public.create_card_expense_old_074(uuid, uuid, uuid, uuid, uuid, date, text, numeric, numeric, numeric, text, numeric, text, text, boolean, jsonb)
      from public, anon, authenticated;
  end if;
end
$do$;

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
  v_fx record;
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
      select * into v_fx from public.fx_settlement('PAGO', p_currency, v_account.currency, v_functional,
        v_net, p_account_amount, p_reference_rate, p_reference_rate_document, v_tolerance);
      v_bank_amount := p_account_amount;
      v_bank_rate := v_fx.account_rate;
      v_functional_amount := v_fx.functional_amount;
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
        case when v_multi then v_fx.effective_rate end,
        case when v_multi then v_fx.effective_rate_currency end,
        p_reference_rate, p_reference_rate_document,
        p_reference_rate_source, coalesce(p_rate_date, case when v_multi then p_expense_date end),
        coalesce(p_rate_manual_override, false),
        case when coalesce(p_rate_manual_override, false) then v_user_id end,
        p_rate_previous,
        case when v_multi then v_fx.rounding_difference else 0 end,
        case when v_multi then v_fx.informative_difference else 0 end
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
      'effective_rate', case when v_multi and v_net > 0 then v_fx.effective_rate end,
      'informative_difference', case when v_multi and v_net > 0 then v_fx.informative_difference else 0 end
    )
  );

  return v_expense_id;
end;
$$;

revoke all on function public.create_card_expense(uuid, uuid, uuid, uuid, uuid, date, text, numeric, numeric, numeric, text, numeric, text, text, boolean, jsonb, numeric, numeric, numeric, numeric, text, date, boolean, numeric) from public, anon;
grant execute on function public.create_card_expense(uuid, uuid, uuid, uuid, uuid, date, text, numeric, numeric, numeric, text, numeric, text, text, boolean, jsonb, numeric, numeric, numeric, numeric, text, date, boolean, numeric) to authenticated, service_role;

-- Limpieza opcional (pegar en el SQL Editor cuando se quiera; no afecta nada):
-- drop function if exists public.register_supplier_payment_old_074(uuid, uuid, uuid, uuid, uuid, date, numeric, text, text, text, numeric, text, text, boolean);
-- drop function if exists public.create_card_expense_old_074(uuid, uuid, uuid, uuid, uuid, date, text, numeric, numeric, numeric, text, numeric, text, text, boolean, jsonb);
