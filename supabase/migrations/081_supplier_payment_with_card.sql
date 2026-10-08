-- 081: Pagar con tarjeta de crédito un gasto que ya estaba pendiente.
--
-- Pedido del usuario en la prueba AM (7-oct): "Un gasto pendiente debe
-- poder pagarse posteriormente con tarjeta, aunque al crearlo no se haya
-- seleccionado tarjeta. El método de pago definitivo se decide al registrar
-- el pago. Mantener las validaciones normales de moneda, saldo y tarjeta."
--
-- Cambios en register_supplier_payment (misma firma; parte de la 080):
-- * Ya no rechaza las cuentas tipo CREDIT_CARD. El pago es un EXPENSE en la
--   tarjeta (sube su deuda); el límite de crédito lo valida el trigger
--   check_bank_transaction_funds ("Crédito insuficiente…"), como en un
--   gasto pagado al crearlo.
-- * Con tarjeta el método del pago queda 'CARD' aunque el formulario mande
--   otro.
-- * Nuevo: no deja pagar desde una cuenta o tarjeta inactiva.
-- * Moneda: igual que cualquier cuenta (misma moneda o bloque de moneda
--   diferente con monto real, tasa y comisión).
-- Los cobros de clientes siguen sin aceptar tarjetas.
--
-- Idempotente. Aplicada en producción el 7-oct-2026.

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
  v_is_card boolean;
  v_method text;
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
  if not v_bank_account.is_active then
    raise exception 'inactive_account: la cuenta o tarjeta «%» está inactiva', v_bank_account.name;
  end if;
  -- Desde la 081 un gasto pendiente también se puede pagar después con una
  -- tarjeta de crédito: sube la deuda de la tarjeta. El límite de crédito lo
  -- controla el trigger de fondos (check_bank_transaction_funds).
  v_is_card := v_bank_account.type = 'CREDIT_CARD';
  v_method := case when v_is_card then 'CARD' else p_method end;

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
    p_payment_date, p_amount, v_method, p_reference, v_expense.currency, v_expense.exchange_rate, p_notes,
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
    case when v_is_card then 'Pago con tarjeta — gasto: ' else 'Pago a proveedor — gasto: ' end || v_expense.description,
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
      'expense_id', p_expense_id, 'amount', p_amount, 'method', v_method,
      'account_type', v_bank_account.type,
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
