-- 090 — Anticipos de clientes (V1-3, 27-oct-2026).
-- Propuesta: claude/propuesta-v1-3-anticipos.md · plan: claude/plan-v1-decisiones.md §3.
--
-- * Un ANTICIPO es dinero que el cliente entrega ANTES de que exista la
--   factura. Tiene su propio recibo (ANT-0001, «RECIBO DE ANTICIPO»), sin
--   impuestos. Va ligado a una cotización aprobada, a un proyecto o solo al
--   cliente.
-- * El dinero entra al banco (categoría «Anticipo de cliente»). NO es venta:
--   no toca facturas, rentabilidad ni reportes de ventas hasta que se APLICA
--   a la factura final.
-- * APLICAR: baja el balance de la factura (invoices.paid_amount/balance/
--   status, igual que un cobro) SIN mover el banco (el dinero ya entró).
-- * DEVOLVER: salida del banco («Devolución a cliente»), con motivo.
-- * PASAR a otro proyecto/cotización del mismo cliente: sin mover dinero.
-- * «Recibido antes del corte» (antes del 1-ene-2027): no crea movimiento de
--   banco (ya está en el saldo inicial) pero sí se aplica a la factura.
-- * Moneda: la de la cotización. Solo se aplica a facturas en esa moneda.
-- * No toca el motor fiscal, las reglas, ni register_customer_payment.
-- Solo agrega. Idempotente.

-- 1. Tablas -------------------------------------------------------------------

create table if not exists public.customer_advances (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  number text not null,
  client_id uuid not null references public.clients (id),
  project_id uuid references public.projects (id) on delete set null,
  quotation_id uuid references public.quotations (id) on delete set null,
  receipt_date date not null,
  currency text not null,
  exchange_rate numeric not null default 1,
  amount numeric(14, 2) not null,
  applied_amount numeric(14, 2) not null default 0,
  refunded_amount numeric(14, 2) not null default 0,
  available_amount numeric(14, 2) generated always as (amount - applied_amount - refunded_amount) stored,
  before_cutoff boolean not null default false,
  method text,
  reference text,
  notes text,
  bank_account_id uuid references public.bank_accounts (id),
  account_currency text,
  account_amount numeric(14, 2),
  bank_fee_amount numeric(14, 2),
  functional_currency text,
  functional_amount numeric(14, 2),
  effective_rate numeric,
  effective_rate_currency text,
  reference_rate numeric,
  reference_rate_document numeric,
  reference_rate_source text,
  rate_date date,
  rate_manual_override boolean not null default false,
  rate_previous numeric,
  rounding_difference numeric not null default 0,
  informative_difference numeric not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_advances_number_key unique (company_id, number),
  constraint customer_advances_amount_check check (amount > 0),
  constraint customer_advances_usage_check check (
    applied_amount >= 0 and refunded_amount >= 0 and applied_amount + refunded_amount <= amount + 0.005
  ),
  constraint customer_advances_bank_check check (before_cutoff or bank_account_id is not null)
);

create index if not exists customer_advances_client_idx on public.customer_advances (company_id, client_id);
create index if not exists customer_advances_project_idx on public.customer_advances (project_id);
create index if not exists customer_advances_quotation_idx on public.customer_advances (quotation_id);

create table if not exists public.customer_advance_movements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  advance_id uuid not null references public.customer_advances (id) on delete cascade,
  kind text not null,
  status text not null default 'ACTIVE',
  movement_date date not null,
  amount numeric(14, 2),
  invoice_id uuid references public.invoices (id),
  bank_account_id uuid references public.bank_accounts (id),
  account_amount numeric(14, 2),
  from_project_id uuid references public.projects (id) on delete set null,
  from_quotation_id uuid references public.quotations (id) on delete set null,
  to_project_id uuid references public.projects (id) on delete set null,
  to_quotation_id uuid references public.quotations (id) on delete set null,
  reason text,
  voided_at timestamptz,
  voided_by uuid references public.profiles (id) on delete set null,
  void_reason text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint customer_advance_movements_kind_check check (kind in ('APPLY', 'REFUND', 'TRANSFER')),
  constraint customer_advance_movements_status_check check (status in ('ACTIVE', 'VOIDED')),
  constraint customer_advance_movements_shape_check check (
    (kind = 'APPLY' and invoice_id is not null and amount > 0)
    or (kind = 'REFUND' and bank_account_id is not null and amount > 0)
    or (kind = 'TRANSFER')
  )
);

create index if not exists customer_advance_movements_advance_idx on public.customer_advance_movements (advance_id);
create index if not exists customer_advance_movements_invoice_idx on public.customer_advance_movements (invoice_id);

-- Movimiento de banco del anticipo (entrada) o de la devolución (salida).
alter table public.bank_transactions
  add column if not exists customer_advance_id uuid references public.customer_advances (id);
create index if not exists bank_transactions_customer_advance_idx on public.bank_transactions (customer_advance_id);

-- La comisión del banco de un anticipo se liga como las demás comisiones.
alter table public.bank_transactions drop constraint if exists bank_transactions_related_source_type_check;
alter table public.bank_transactions add constraint bank_transactions_related_source_type_check
  check (related_source_type is null or related_source_type = any (array[
    'supplier_payment'::text, 'customer_payment'::text, 'bank_transfer'::text, 'customer_advance'::text
  ]));

do $do$
begin
  if not exists (select 1 from pg_trigger where tgname = 'set_updated_at' and tgrelid = 'public.customer_advances'::regclass) then
    create trigger set_updated_at before update on public.customer_advances
      for each row execute function public.set_updated_at();
  end if;
  if not exists (select 1 from pg_policies where tablename = 'customer_advances' and policyname = 'customer_advances_select') then
    create policy customer_advances_select on public.customer_advances
      for select using (
        company_id in (select public.user_company_ids())
        and (public.has_permission('payments.view') or public.has_permission('invoices.view')
             or public.has_permission('projects.view') or public.has_permission('quotations.view')
             or public.has_permission('reports.view'))
      );
  end if;
  if not exists (select 1 from pg_policies where tablename = 'customer_advance_movements' and policyname = 'customer_advance_movements_select') then
    create policy customer_advance_movements_select on public.customer_advance_movements
      for select using (
        company_id in (select public.user_company_ids())
        and (public.has_permission('payments.view') or public.has_permission('invoices.view')
             or public.has_permission('projects.view') or public.has_permission('quotations.view')
             or public.has_permission('reports.view'))
      );
  end if;
end
$do$;

alter table public.customer_advances enable row level security;
alter table public.customer_advance_movements enable row level security;
-- Sin políticas de escritura: solo se escribe con las funciones de abajo.
revoke all on public.customer_advances from anon;
revoke all on public.customer_advance_movements from anon;
grant select on public.customer_advances to authenticated;
grant select on public.customer_advance_movements to authenticated;
grant all on public.customer_advances to service_role;
grant all on public.customer_advance_movements to service_role;

comment on table public.customer_advances is
  '090: anticipos de clientes (recibo ANT-0001). Dinero recibido antes de la factura; no es venta hasta que se aplica.';
comment on table public.customer_advance_movements is
  '090: uso de un anticipo: APPLY (a una factura, sin banco), REFUND (devolución, sale del banco), TRANSFER (otro proyecto/cotización).';

-- 2. Ayudas -------------------------------------------------------------------

-- Fecha de corte del Go-Live (plan V1 §6). «Recibido antes del corte» solo antes de esta fecha.
create or replace function public.mf_cutoff_date()
returns date
language sql
immutable
set search_path = ''
as $$ select date '2027-01-01' $$;

-- Tasa de referencia registrada en o antes de la fecha (cuántos pesos vale 1 unidad).
create or replace function public.mf_rate_on(p_company_id uuid, p_currency text, p_date date)
returns numeric
language sql
stable
set search_path = public
as $$
  select r.rate_to_base from public.exchange_rates r
   where r.company_id = p_company_id and r.currency_code = p_currency and r.effective_date <= p_date
   order by r.effective_date desc, r.created_at desc
   limit 1
$$;

-- 3. Registrar anticipo -------------------------------------------------------

create or replace function public.register_customer_advance(
  p_company_id uuid,
  p_client_id uuid,
  p_project_id uuid,
  p_quotation_id uuid,
  p_receipt_date date,
  p_amount numeric,
  p_currency text,
  p_method text,
  p_reference text,
  p_notes text,
  p_before_cutoff boolean default false,
  p_bank_account_id uuid default null,
  p_account_amount numeric default null,
  p_bank_fee numeric default null,
  p_reference_rate numeric default null,
  p_reference_rate_document numeric default null,
  p_reference_rate_source text default null,
  p_rate_date date default null,
  p_rate_manual_override boolean default false,
  p_rate_previous numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_id uuid;
  v_number text;
  v_next int;
  v_client record;
  v_project record;
  v_quotation record;
  v_project_id uuid := p_project_id;
  v_q_project uuid;
  v_currency text := upper(trim(coalesce(p_currency, '')));
  v_amount numeric := round(coalesce(p_amount, 0), 2);
  v_fee numeric := round(coalesce(p_bank_fee, 0), 2);
  v_cutoff boolean := coalesce(p_before_cutoff, false);
  v_functional text;
  v_rate numeric;
  v_tolerance numeric;
  v_account record;
  v_acc_currency text;
  v_multi boolean := false;
  v_fx_eff numeric;
  v_fx_eff_cur text;
  v_fx_func numeric;
  v_fx_round numeric;
  v_fx_info numeric;
  v_fx_acc numeric;
  v_bank_amount numeric;
  v_bank_rate numeric;
  v_functional_amount numeric;
begin
  if not public.has_permission('payments.create') then
    raise exception 'insufficient_privilege: falta el permiso payments.create';
  end if;
  if p_company_id not in (select * from public.user_company_ids()) then
    raise exception 'company_mismatch: no tienes acceso a esta compañía';
  end if;
  if v_amount <= 0 then
    raise exception 'invalid_amount: el monto del anticipo debe ser mayor a 0';
  end if;
  if p_receipt_date is null then
    raise exception 'invalid_date: falta la fecha en que se recibió el anticipo';
  end if;

  select * into v_client from public.clients where id = p_client_id;
  if not found or v_client.company_id <> p_company_id then
    raise exception 'client_not_found: el cliente no existe o no pertenece a esta compañía';
  end if;

  if p_quotation_id is not null then
    select * into v_quotation from public.quotations where id = p_quotation_id;
    if not found or v_quotation.company_id <> p_company_id then
      raise exception 'quotation_not_found: la cotización no existe';
    end if;
    if v_quotation.client_id <> p_client_id then
      raise exception 'client_mismatch: la cotización es de otro cliente';
    end if;
    if v_quotation.status <> 'APPROVED' then
      raise exception 'quotation_not_approved: solo se reciben anticipos de una cotización aprobada (apruébala primero)';
    end if;
    if v_currency <> v_quotation.currency then
      raise exception 'currency_mismatch_quotation: el anticipo va en la moneda de la cotización (%)', v_quotation.currency;
    end if;
    -- Si la cotización ya está en un proyecto, el anticipo también.
    v_q_project := v_quotation.project_id;
    v_project_id := coalesce(v_project_id, v_q_project);
  end if;

  if v_project_id is not null then
    select * into v_project from public.projects where id = v_project_id;
    if not found or v_project.company_id <> p_company_id then
      raise exception 'project_not_found: el proyecto no existe';
    end if;
    if v_project.client_id <> p_client_id then
      raise exception 'client_mismatch: el proyecto es de otro cliente';
    end if;
    if v_project.status = 'CANCELLED' then
      raise exception 'project_cancelled: el proyecto está cancelado; no recibe anticipos';
    end if;
    if v_q_project is not null and v_q_project <> v_project_id then
      raise exception 'quotation_project_mismatch: la cotización pertenece a otro proyecto';
    end if;
  end if;

  if v_currency !~ '^[A-Z]{3}$' then
    raise exception 'invalid_currency: moneda inválida';
  end if;

  select c.base_currency into v_functional from public.companies c where c.id = p_company_id;

  -- Tasa del anticipo (para llevarlo a pesos en reportes): 1 en la moneda de la empresa.
  if v_currency = v_functional then
    v_rate := 1;
  else
    v_rate := coalesce(nullif(p_reference_rate_document, 0), public.mf_rate_on(p_company_id, v_currency, p_receipt_date));
    if coalesce(v_rate, 0) <= 0 then
      raise exception 'reference_rate_required: Falta la tasa de referencia de % (cuántos % vale 1 %).', v_currency, v_functional, v_currency;
    end if;
  end if;

  if v_cutoff then
    if p_receipt_date >= public.mf_cutoff_date() then
      raise exception 'cutoff_date: «Recibido antes del corte» es solo para anticipos recibidos antes del %', to_char(public.mf_cutoff_date(), 'DD-MM-YYYY');
    end if;
    if v_fee > 0 then
      raise exception 'invalid_amount: un anticipo recibido antes del corte no lleva comisión del banco';
    end if;
  else
    if p_bank_account_id is null then
      raise exception 'bank_account_required: debes elegir la cuenta donde entró el anticipo';
    end if;
    select * into v_account from public.bank_accounts where id = p_bank_account_id;
    if not found or v_account.company_id <> p_company_id then
      raise exception 'account_not_found: la cuenta bancaria no existe o no pertenece a esta compañía';
    end if;
    if v_account.type = 'CREDIT_CARD' then
      raise exception 'invalid_account_type: no se puede recibir un anticipo en una tarjeta de crédito';
    end if;
    if v_fee < 0 then
      raise exception 'invalid_amount: la comisión no puede ser negativa';
    end if;

    select s.rounding_tolerance into v_tolerance from public.currency_settings s where s.company_id = p_company_id;
    v_tolerance := coalesce(v_tolerance, 1);
    v_acc_currency := v_account.currency;
    v_multi := v_acc_currency <> v_currency;

    if v_multi then
      select f.effective_rate, f.effective_rate_currency, f.functional_amount, f.rounding_difference, f.informative_difference, f.account_rate
        into v_fx_eff, v_fx_eff_cur, v_fx_func, v_fx_round, v_fx_info, v_fx_acc
        from public.fx_settlement('COBRO', v_currency, v_account.currency, v_functional,
        v_amount, p_account_amount, p_reference_rate, coalesce(nullif(p_reference_rate_document, 0), v_rate), v_tolerance) f;
      v_bank_amount := p_account_amount;
      v_bank_rate := v_fx_acc;
      v_functional_amount := v_fx_func;
    else
      if p_account_amount is not null and p_account_amount <> v_amount then
        raise exception 'invalid_amount: misma moneda, el monto del banco debe ser igual al anticipo';
      end if;
      v_bank_amount := v_amount;
      v_bank_rate := v_rate;
      v_functional_amount := round(v_amount * v_rate, 2);
    end if;

    if v_fee >= v_bank_amount then
      raise exception 'invalid_amount: la comisión no puede ser igual o mayor que lo que entró al banco';
    end if;
  end if;

  -- Número consecutivo ANT-0001 por compañía (sin choques entre dos usuarios a la vez).
  perform pg_advisory_xact_lock(hashtext('customer_advance_number:' || p_company_id::text));
  select coalesce(max(substring(a.number from 5)::int), 0) + 1 into v_next
    from public.customer_advances a
   where a.company_id = p_company_id and a.number ~ '^ANT-[0-9]+$';
  v_number := 'ANT-' || lpad(v_next::text, 4, '0');

  insert into public.customer_advances (
    company_id, number, client_id, project_id, quotation_id, receipt_date, currency, exchange_rate, amount,
    before_cutoff, method, reference, notes, bank_account_id,
    account_currency, account_amount, bank_fee_amount, functional_currency, functional_amount,
    effective_rate, effective_rate_currency, reference_rate, reference_rate_document, reference_rate_source,
    rate_date, rate_manual_override, rate_previous, rounding_difference, informative_difference, created_by
  ) values (
    p_company_id, v_number, p_client_id, v_project_id, p_quotation_id, p_receipt_date, v_currency, v_rate, v_amount,
    v_cutoff, nullif(trim(coalesce(p_method, '')), ''), nullif(trim(coalesce(p_reference, '')), ''),
    nullif(trim(coalesce(p_notes, '')), ''),
    case when v_cutoff then null else p_bank_account_id end,
    v_acc_currency,
    case when v_cutoff then null else v_bank_amount end,
    nullif(v_fee, 0), v_functional,
    case when v_cutoff then round(v_amount * v_rate, 2) else v_functional_amount end,
    case when v_multi then v_fx_eff end, case when v_multi then v_fx_eff_cur end,
    case when v_cutoff then null else p_reference_rate end,
    case when v_currency = v_functional then null else v_rate end,
    p_reference_rate_source,
    coalesce(p_rate_date, case when v_multi then p_receipt_date end),
    coalesce(p_rate_manual_override, false), p_rate_previous,
    case when v_multi then v_fx_round else 0 end,
    case when v_multi then v_fx_info else 0 end,
    v_user_id
  )
  returning id into v_id;

  if not v_cutoff then
    insert into public.bank_transactions (
      company_id, bank_account_id, project_id, client_id, customer_advance_id,
      type, amount, currency, exchange_rate, transaction_date, description, category_id, reference
    ) values (
      p_company_id, p_bank_account_id, v_project_id, p_client_id, v_id,
      'INCOME', v_bank_amount, v_acc_currency, v_bank_rate, p_receipt_date,
      'Anticipo ' || v_number || ' — ' || v_client.name,
      public.find_expense_category(p_company_id, 'Anticipo de cliente'),
      nullif(trim(coalesce(p_reference, '')), '')
    );

    if v_fee > 0 then
      insert into public.bank_transactions (
        company_id, bank_account_id, project_id, client_id,
        type, amount, currency, exchange_rate, transaction_date, description,
        category_id, system_concept, related_source_type, related_source_id, overdraft_confirmed
      ) values (
        p_company_id, p_bank_account_id, v_project_id, p_client_id,
        'EXPENSE', v_fee, v_acc_currency, v_bank_rate, p_receipt_date,
        'Comisión bancaria — anticipo ' || v_number,
        public.find_expense_category(p_company_id, 'Comisiones bancarias'),
        'BANK_FEE', 'customer_advance', v_id, true
      );
    end if;
  end if;

  insert into public.audit_logs (company_id, user_id, action, entity_type, entity_id, new_values)
  values (
    p_company_id, v_user_id, 'CREATE', 'customer_advance', v_id,
    jsonb_build_object(
      'number', v_number, 'client_id', p_client_id, 'project_id', v_project_id, 'quotation_id', p_quotation_id,
      'amount', v_amount, 'currency', v_currency, 'exchange_rate', v_rate, 'receipt_date', p_receipt_date,
      'before_cutoff', v_cutoff, 'bank_account_id', case when v_cutoff then null else p_bank_account_id end,
      'account_amount', case when v_cutoff then null else v_bank_amount end, 'bank_fee', v_fee,
      'method', p_method, 'reference', p_reference
    )
  );

  return v_id;
end;
$function$;

-- 4. Aplicar a una factura ----------------------------------------------------

create or replace function public.apply_customer_advance(
  p_advance_id uuid,
  p_invoice_id uuid,
  p_amount numeric,
  p_date date default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_adv record;
  v_inv record;
  v_amount numeric := round(coalesce(p_amount, 0), 2);
  v_id uuid;
  v_new_paid numeric;
  v_new_balance numeric;
  v_new_status text;
begin
  if not public.has_permission('payments.create') then
    raise exception 'insufficient_privilege: falta el permiso payments.create';
  end if;
  select * into v_adv from public.customer_advances where id = p_advance_id for update;
  if not found or v_adv.company_id not in (select * from public.user_company_ids()) then
    raise exception 'advance_not_found: el anticipo no existe';
  end if;
  select * into v_inv from public.invoices where id = p_invoice_id for update;
  if not found or v_inv.company_id <> v_adv.company_id then
    raise exception 'invoice_not_found: la factura no existe';
  end if;
  if v_inv.client_id <> v_adv.client_id then
    raise exception 'client_mismatch: el anticipo es de otro cliente';
  end if;
  if v_inv.status not in ('ISSUED', 'PARTIALLY_PAID', 'OVERDUE') then
    raise exception 'invalid_status: el anticipo solo se aplica a una factura emitida con balance pendiente';
  end if;
  if v_inv.currency <> v_adv.currency then
    raise exception 'currency_mismatch_invoice: el anticipo está en % y la factura en %; solo se aplica a facturas en la misma moneda', v_adv.currency, v_inv.currency;
  end if;
  -- De qué facturas es: las de su proyecto o cotización; si es «solo del cliente», cualquiera del cliente.
  if not (
    (v_adv.project_id is null and v_adv.quotation_id is null)
    or (v_adv.project_id is not null and v_inv.project_id = v_adv.project_id)
    or (v_adv.quotation_id is not null and v_inv.quotation_id = v_adv.quotation_id)
  ) then
    raise exception 'advance_not_for_invoice: este anticipo es de otro proyecto o cotización; pásalo primero a este proyecto';
  end if;
  if v_amount <= 0 then
    raise exception 'invalid_amount: el monto a aplicar debe ser mayor a 0';
  end if;
  if v_amount > v_adv.available_amount + 0.005 then
    raise exception 'amount_exceeds_available: el anticipo solo tiene % disponible', v_adv.available_amount;
  end if;
  if v_amount > v_inv.balance + 0.005 then
    raise exception 'amount_exceeds_balance: la factura solo debe %', v_inv.balance;
  end if;

  insert into public.customer_advance_movements (company_id, advance_id, kind, movement_date, amount, invoice_id, created_by)
  values (v_adv.company_id, v_adv.id, 'APPLY', coalesce(p_date, current_date), v_amount, v_inv.id, v_user_id)
  returning id into v_id;

  update public.customer_advances set applied_amount = applied_amount + v_amount where id = v_adv.id;

  v_new_paid := v_inv.paid_amount + v_amount;
  v_new_balance := v_inv.total - v_new_paid;
  v_new_status := case when v_new_balance <= 0.005 then 'PAID' else 'PARTIALLY_PAID' end;
  update public.invoices
     set paid_amount = v_new_paid,
         balance = greatest(0, round(v_new_balance, 2)),
         status = v_new_status
   where id = v_inv.id;

  insert into public.audit_logs (company_id, user_id, action, entity_type, entity_id, new_values)
  values (
    v_adv.company_id, v_user_id, 'APPLY', 'customer_advance', v_adv.id,
    jsonb_build_object('number', v_adv.number, 'invoice_id', v_inv.id, 'invoice_number', v_inv.number,
      'amount', v_amount, 'currency', v_adv.currency, 'movement_id', v_id,
      'invoice_balance_before', v_inv.balance, 'invoice_balance_after', greatest(0, round(v_new_balance, 2)),
      'new_invoice_status', v_new_status)
  );
  return v_id;
end;
$function$;

-- 5. Quitar una aplicación (error al aplicar) ---------------------------------

create or replace function public.void_customer_advance_application(p_movement_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_mov record;
  v_adv record;
  v_inv record;
  v_new_paid numeric;
begin
  if not public.has_permission('payments.void') then
    raise exception 'insufficient_privilege: falta el permiso payments.void';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'reason_required: escribe el motivo';
  end if;
  select * into v_mov from public.customer_advance_movements where id = p_movement_id for update;
  if not found or v_mov.company_id not in (select * from public.user_company_ids()) then
    raise exception 'movement_not_found: la aplicación no existe';
  end if;
  if v_mov.kind <> 'APPLY' or v_mov.status <> 'ACTIVE' then
    raise exception 'invalid_status: esta aplicación ya fue quitada';
  end if;
  select * into v_adv from public.customer_advances where id = v_mov.advance_id for update;
  select * into v_inv from public.invoices where id = v_mov.invoice_id for update;

  update public.customer_advance_movements
     set status = 'VOIDED', voided_at = now(), voided_by = v_user_id, void_reason = trim(p_reason)
   where id = v_mov.id;
  update public.customer_advances set applied_amount = applied_amount - v_mov.amount where id = v_adv.id;

  if v_inv.status <> 'CANCELLED' then
    v_new_paid := greatest(0, v_inv.paid_amount - v_mov.amount);
    update public.invoices
       set paid_amount = v_new_paid,
           balance = round(v_inv.total - v_new_paid, 2),
           status = case when v_new_paid <= 0.005 then 'ISSUED' else 'PARTIALLY_PAID' end
     where id = v_inv.id;
  end if;

  insert into public.audit_logs (company_id, user_id, action, entity_type, entity_id, old_values, new_values)
  values (
    v_adv.company_id, v_user_id, 'VOID_APPLY', 'customer_advance', v_adv.id,
    jsonb_build_object('movement_id', v_mov.id, 'invoice_id', v_inv.id, 'invoice_number', v_inv.number, 'amount', v_mov.amount),
    jsonb_build_object('reason', trim(p_reason), 'number', v_adv.number)
  );
end;
$function$;

-- 6. Devolver (evento cancelado) ----------------------------------------------

create or replace function public.refund_customer_advance(
  p_advance_id uuid,
  p_amount numeric,
  p_date date,
  p_bank_account_id uuid,
  p_reason text,
  p_account_amount numeric default null,
  p_confirm_overdraft boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_adv record;
  v_account record;
  v_amount numeric := round(coalesce(p_amount, 0), 2);
  v_bank_amount numeric;
  v_rate numeric;
  v_functional text;
  v_id uuid;
  v_client_name text;
begin
  if not public.has_permission('payments.void') then
    raise exception 'insufficient_privilege: falta el permiso payments.void';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'reason_required: escribe el motivo de la devolución';
  end if;
  select * into v_adv from public.customer_advances where id = p_advance_id for update;
  if not found or v_adv.company_id not in (select * from public.user_company_ids()) then
    raise exception 'advance_not_found: el anticipo no existe';
  end if;
  if v_amount <= 0 then
    raise exception 'invalid_amount: el monto a devolver debe ser mayor a 0';
  end if;
  if v_amount > v_adv.available_amount + 0.005 then
    raise exception 'amount_exceeds_available: el anticipo solo tiene % disponible', v_adv.available_amount;
  end if;
  select * into v_account from public.bank_accounts where id = p_bank_account_id;
  if not found or v_account.company_id <> v_adv.company_id then
    raise exception 'bank_account_required: elige la cuenta de donde sale la devolución';
  end if;
  if v_account.type = 'CREDIT_CARD' then
    raise exception 'invalid_account_type: la devolución sale de una cuenta bancaria, no de una tarjeta';
  end if;
  select c.base_currency into v_functional from public.companies c where c.id = v_adv.company_id;

  if v_account.currency = v_adv.currency then
    v_bank_amount := v_amount;
    v_rate := v_adv.exchange_rate;
  else
    if coalesce(p_account_amount, 0) <= 0 then
      raise exception 'account_amount_required: Indica cuánto salió realmente de la cuenta (en %).', v_account.currency;
    end if;
    v_bank_amount := round(p_account_amount, 2);
    v_rate := case when v_account.currency = v_functional then 1
                   else coalesce(public.mf_rate_on(v_adv.company_id, v_account.currency, coalesce(p_date, current_date)), 1) end;
  end if;

  select name into v_client_name from public.clients where id = v_adv.client_id;

  insert into public.bank_transactions (
    company_id, bank_account_id, project_id, client_id, customer_advance_id,
    type, amount, currency, exchange_rate, transaction_date, description, category_id, overdraft_confirmed
  ) values (
    v_adv.company_id, p_bank_account_id, v_adv.project_id, v_adv.client_id, v_adv.id,
    'EXPENSE', v_bank_amount, v_account.currency, v_rate, coalesce(p_date, current_date),
    'Devolución anticipo ' || v_adv.number || ' — ' || coalesce(v_client_name, ''),
    public.find_expense_category(v_adv.company_id, 'Devolución a cliente'),
    coalesce(p_confirm_overdraft, false)
  );

  insert into public.customer_advance_movements (
    company_id, advance_id, kind, movement_date, amount, bank_account_id, account_amount, reason, created_by
  ) values (
    v_adv.company_id, v_adv.id, 'REFUND', coalesce(p_date, current_date), v_amount, p_bank_account_id, v_bank_amount,
    trim(p_reason), v_user_id
  )
  returning id into v_id;

  update public.customer_advances set refunded_amount = refunded_amount + v_amount where id = v_adv.id;

  insert into public.audit_logs (company_id, user_id, action, entity_type, entity_id, new_values)
  values (
    v_adv.company_id, v_user_id, 'REFUND', 'customer_advance', v_adv.id,
    jsonb_build_object('number', v_adv.number, 'amount', v_amount, 'currency', v_adv.currency,
      'bank_account_id', p_bank_account_id, 'account_amount', v_bank_amount, 'reason', trim(p_reason), 'movement_id', v_id)
  );
  return v_id;
end;
$function$;

-- 7. Pasar a otro proyecto / cotización del mismo cliente ---------------------

create or replace function public.transfer_customer_advance(
  p_advance_id uuid,
  p_project_id uuid,
  p_quotation_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_adv record;
  v_project record;
  v_quotation record;
  v_project_id uuid := p_project_id;
  v_id uuid;
begin
  if not public.has_permission('payments.void') then
    raise exception 'insufficient_privilege: falta el permiso payments.void';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'reason_required: escribe el motivo';
  end if;
  select * into v_adv from public.customer_advances where id = p_advance_id for update;
  if not found or v_adv.company_id not in (select * from public.user_company_ids()) then
    raise exception 'advance_not_found: el anticipo no existe';
  end if;
  if v_adv.applied_amount > 0.005 then
    raise exception 'advance_partially_applied: una parte ya se aplicó a una factura; solo se pasa un anticipo sin aplicar';
  end if;
  if v_adv.available_amount <= 0.005 then
    raise exception 'advance_used: este anticipo ya no tiene saldo disponible';
  end if;

  if p_quotation_id is not null then
    select * into v_quotation from public.quotations where id = p_quotation_id;
    if not found or v_quotation.company_id <> v_adv.company_id or v_quotation.client_id <> v_adv.client_id then
      raise exception 'client_mismatch: la cotización debe ser del mismo cliente';
    end if;
    if v_quotation.status <> 'APPROVED' then
      raise exception 'quotation_not_approved: la cotización destino debe estar aprobada';
    end if;
    if v_quotation.currency <> v_adv.currency then
      raise exception 'currency_mismatch_quotation: el anticipo está en % y la cotización en %', v_adv.currency, v_quotation.currency;
    end if;
    v_project_id := coalesce(v_project_id, v_quotation.project_id);
  end if;
  if v_project_id is not null then
    select * into v_project from public.projects where id = v_project_id;
    if not found or v_project.company_id <> v_adv.company_id or v_project.client_id <> v_adv.client_id then
      raise exception 'client_mismatch: el proyecto debe ser del mismo cliente';
    end if;
    if v_project.status = 'CANCELLED' then
      raise exception 'project_cancelled: el proyecto destino está cancelado';
    end if;
  end if;
  if v_project_id is not distinct from v_adv.project_id and p_quotation_id is not distinct from v_adv.quotation_id then
    raise exception 'same_target: el anticipo ya está en ese proyecto o cotización';
  end if;

  insert into public.customer_advance_movements (
    company_id, advance_id, kind, movement_date, amount, from_project_id, from_quotation_id,
    to_project_id, to_quotation_id, reason, created_by
  ) values (
    v_adv.company_id, v_adv.id, 'TRANSFER', current_date, v_adv.available_amount, v_adv.project_id, v_adv.quotation_id,
    v_project_id, p_quotation_id, trim(p_reason), v_user_id
  )
  returning id into v_id;

  update public.customer_advances set project_id = v_project_id, quotation_id = p_quotation_id where id = v_adv.id;

  insert into public.audit_logs (company_id, user_id, action, entity_type, entity_id, old_values, new_values)
  values (
    v_adv.company_id, v_user_id, 'TRANSFER', 'customer_advance', v_adv.id,
    jsonb_build_object('project_id', v_adv.project_id, 'quotation_id', v_adv.quotation_id),
    jsonb_build_object('project_id', v_project_id, 'quotation_id', p_quotation_id, 'reason', trim(p_reason), 'number', v_adv.number)
  );
  return v_id;
end;
$function$;

-- 8. Automáticos --------------------------------------------------------------

-- Factura cancelada: lo aplicado de anticipos vuelve a quedar disponible.
create or replace function public.release_advances_on_invoice_cancel()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_mov record;
begin
  if new.status = 'CANCELLED' and old.status is distinct from 'CANCELLED' then
    for v_mov in
      select * from public.customer_advance_movements
       where invoice_id = new.id and kind = 'APPLY' and status = 'ACTIVE'
       for update
    loop
      update public.customer_advance_movements
         set status = 'VOIDED', voided_at = now(), voided_by = auth.uid(),
             void_reason = 'Factura ' || new.number || ' cancelada: el anticipo vuelve a estar disponible'
       where id = v_mov.id;
      update public.customer_advances set applied_amount = applied_amount - v_mov.amount where id = v_mov.advance_id;
      insert into public.audit_logs (company_id, user_id, action, entity_type, entity_id, new_values)
      values (new.company_id, auth.uid(), 'VOID_APPLY', 'customer_advance', v_mov.advance_id,
        jsonb_build_object('movement_id', v_mov.id, 'invoice_id', new.id, 'invoice_number', new.number,
          'amount', v_mov.amount, 'reason', 'Factura cancelada'));
    end loop;
  end if;
  return new;
end;
$function$;

do $do$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_release_advances_on_invoice_cancel' and tgrelid = 'public.invoices'::regclass) then
    create trigger trg_release_advances_on_invoice_cancel
      after update of status on public.invoices
      for each row execute function public.release_advances_on_invoice_cancel();
  end if;
end
$do$;

-- Cotización que pasa a un proyecto: sus anticipos se van con ella.
create or replace function public.follow_quotation_project_advances()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if new.project_id is distinct from old.project_id and new.project_id is not null then
    update public.customer_advances
       set project_id = new.project_id
     where quotation_id = new.id and (project_id is null or project_id = old.project_id);
  end if;
  return new;
end;
$function$;

do $do$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_follow_quotation_project_advances' and tgrelid = 'public.quotations'::regclass) then
    create trigger trg_follow_quotation_project_advances
      after update of project_id on public.quotations
      for each row execute function public.follow_quotation_project_advances();
  end if;
end
$do$;

-- 9. Permisos de ejecución ------------------------------------------------------

revoke all on function public.register_customer_advance(uuid, uuid, uuid, uuid, date, numeric, text, text, text, text, boolean, uuid, numeric, numeric, numeric, numeric, text, date, boolean, numeric) from public, anon;
revoke all on function public.apply_customer_advance(uuid, uuid, numeric, date) from public, anon;
revoke all on function public.void_customer_advance_application(uuid, text) from public, anon;
revoke all on function public.refund_customer_advance(uuid, numeric, date, uuid, text, numeric, boolean) from public, anon;
revoke all on function public.transfer_customer_advance(uuid, uuid, uuid, text) from public, anon;
revoke all on function public.release_advances_on_invoice_cancel() from public, anon, authenticated;
revoke all on function public.follow_quotation_project_advances() from public, anon, authenticated;
grant execute on function public.register_customer_advance(uuid, uuid, uuid, uuid, date, numeric, text, text, text, text, boolean, uuid, numeric, numeric, numeric, numeric, text, date, boolean, numeric) to authenticated;
grant execute on function public.apply_customer_advance(uuid, uuid, numeric, date) to authenticated;
grant execute on function public.void_customer_advance_application(uuid, text) to authenticated;
grant execute on function public.refund_customer_advance(uuid, numeric, date, uuid, text, numeric, boolean) to authenticated;
grant execute on function public.transfer_customer_advance(uuid, uuid, uuid, text) to authenticated;
