-- 077: Multimoneda operacional V5 — paso 3: cobros a clientes desde/hacia
-- una cuenta en moneda diferente (claude/propuesta-multimoneda-pagos.md).
--
-- * customer_payments: las mismas columnas opcionales que supplier_payments
--   (migración 076). `amount` sigue siendo el MONTO APLICADO a la factura
--   (moneda de la factura) y `currency` la moneda de la factura.
-- * register_customer_payment: parámetros opcionales nuevos. Misma moneda →
--   igual que antes. Moneda diferente → exige el monto que realmente entró
--   al banco y la tasa de referencia (fx_settlement, tipo COBRO); el
--   movimiento de banco entra en la moneda de la cuenta. Si el banco cobró
--   comisión por recibir el dinero, es un movimiento aparte (Comisiones
--   bancarias, ligado al cobro).
-- * Nuevo: el cliente del cobro debe ser el cliente de la factura
--   (client_mismatch). Producción: 0 cobros con cliente distinto.
--
-- Idempotente. Aplicada en producción el 5-oct-2026.

alter table public.customer_payments
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

-- La versión anterior (13 parámetros) se RENOMBRA (Supabase pide
-- confirmación para borrar funciones) y queda sin permisos.
do $do$
begin
  if to_regprocedure('public.register_customer_payment(uuid, uuid, uuid, uuid, uuid, date, numeric, text, text, text, numeric, text, uuid)') is not null then
    alter function public.register_customer_payment(uuid, uuid, uuid, uuid, uuid, date, numeric, text, text, text, numeric, text, uuid)
      rename to register_customer_payment_old_062;
    revoke all on function public.register_customer_payment_old_062(uuid, uuid, uuid, uuid, uuid, date, numeric, text, text, text, numeric, text, uuid)
      from public, anon, authenticated;
  end if;
end
$do$;

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
    select * into v_fx from public.fx_settlement('COBRO', v_invoice.currency, v_bank_account.currency, v_functional,
      p_amount, p_account_amount, p_reference_rate, p_reference_rate_document, v_tolerance);
    v_bank_amount := p_account_amount;
    v_bank_rate := v_fx.account_rate;
    v_functional_amount := v_fx.functional_amount;
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
      'effective_rate', case when v_multi then v_fx.effective_rate end,
      'rounding_difference', case when v_multi then v_fx.rounding_difference else 0 end,
      'informative_difference', case when v_multi then v_fx.informative_difference else 0 end
    )
  );

  return v_payment_id;
end;
$$;

revoke all on function public.register_customer_payment(uuid, uuid, uuid, uuid, uuid, date, numeric, text, text, text, numeric, text, uuid, numeric, numeric, numeric, numeric, text, date, boolean, numeric) from public, anon;
grant execute on function public.register_customer_payment(uuid, uuid, uuid, uuid, uuid, date, numeric, text, text, text, numeric, text, uuid, numeric, numeric, numeric, numeric, text, date, boolean, numeric) to authenticated, service_role;

-- Limpieza opcional (pegar en el SQL Editor cuando se quiera; no afecta nada):
-- drop function if exists public.register_customer_payment_old_062(uuid, uuid, uuid, uuid, uuid, date, numeric, text, text, text, numeric, text, uuid);
