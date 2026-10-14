-- 083 — Retenciones que hacen los clientes al pagar una factura (13-oct-2026).
-- Propuesta: claude/propuesta-retenciones-clientes.md (decisiones del 5-oct
-- y revisión final del 13-oct).
--
-- * Una factura se salda con DINERO RECIBIDO EN BANCO + RETENCIONES del
--   cliente. La retención reduce el saldo de la factura, pero NO mueve el
--   banco (ese dinero nunca entró: el cliente lo paga a la DGII).
-- * customer_payments.amount sigue siendo el DINERO recibido (moneda de la
--   factura) → Dashboard, rentabilidad y reportes siguen igual.
--   withholding_total = retenciones activas del cobro; amount_applied =
--   amount + withholding_total (lo que rebaja la factura).
-- * invoices.paid_amount = TOTAL APLICADO (dinero + retenciones activas);
--   invoices.withholding_total = retenciones activas. balance y estados se
--   calculan igual que antes.
-- * Retenciones en la MONEDA DE LA FACTURA (lo que rebaja el saldo). Si la
--   factura es en otra moneda (ej. USD), se guarda además el monto del
--   certificado de la DGII en pesos (certificate_amount, informativo).
-- * Multimoneda V5: las retenciones nunca entran en la tasa efectiva, la
--   comisión, el redondeo ni la diferencia informativa (solo el dinero).
-- * Cobro solo con retención (recibido 0): sin cuenta ni movimiento de banco.
-- * Correcciones trazables: agregar certificado después y anular retención
--   (motivo obligatorio, estado VOIDED, nunca se borra; permiso nuevo
--   payments.void para ADMIN y FINANCE).
--
-- No toca: motor fiscal de proveedores, fiscal_rules, expenses, anticipos.
-- Idempotente. La versión anterior de register_customer_payment se RENOMBRA
-- (Supabase pide confirmación para borrar funciones).

-- 1. Columnas nuevas -------------------------------------------------------

alter table public.customer_payments
  add column if not exists withholding_total numeric(14, 2) not null default 0;

do $do$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'customer_payments' and column_name = 'amount_applied'
  ) then
    alter table public.customer_payments
      add column amount_applied numeric(14, 2) generated always as (amount + withholding_total) stored;
  end if;
end
$do$;

do $do$
begin
  if not exists (select 1 from pg_constraint where conname = 'customer_payments_withholding_total_check') then
    alter table public.customer_payments
      add constraint customer_payments_withholding_total_check check (withholding_total >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'customer_payments_amounts_check') then
    alter table public.customer_payments
      add constraint customer_payments_amounts_check check (amount >= 0);
  end if;
end
$do$;

alter table public.invoices
  add column if not exists withholding_total numeric(14, 2) not null default 0;

comment on column public.customer_payments.amount is
  'Dinero recibido aplicado a la factura (moneda de la factura). No incluye retenciones.';
comment on column public.customer_payments.withholding_total is
  'Retenciones activas del cliente en este cobro (moneda de la factura). No mueven el banco.';
comment on column public.customer_payments.amount_applied is
  'Total aplicado a la factura = dinero + retenciones.';
comment on column public.invoices.paid_amount is
  'Total APLICADO: dinero recibido + retenciones activas del cliente.';
comment on column public.invoices.withholding_total is
  'Retenciones activas del cliente aplicadas a la factura (moneda de la factura).';

-- 2. Tabla de retenciones --------------------------------------------------

create table if not exists public.customer_payment_withholdings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  customer_payment_id uuid not null references public.customer_payments (id) on delete restrict,
  invoice_id uuid not null references public.invoices (id) on delete restrict,
  client_id uuid not null references public.clients (id) on delete restrict,
  withholding_type text not null check (withholding_type in ('ISR', 'ITBIS', 'OTRO')),
  amount numeric(14, 2) not null check (amount > 0),
  currency text not null,
  -- Monto del certificado de la DGII (siempre en la moneda funcional, RD$).
  -- En facturas en pesos es igual a amount; en facturas en otra moneda lo
  -- escribe el usuario (informativo, no afecta saldos).
  certificate_amount numeric(14, 2) check (certificate_amount is null or certificate_amount > 0),
  certificate_currency text,
  base_amount numeric(14, 2) check (base_amount is null or base_amount > 0),
  withholding_date date not null,
  certificate_number text,
  reference text,
  notes text,
  document_id uuid references public.documents (id) on delete set null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'VOIDED')),
  voided_at timestamptz,
  voided_by uuid references public.profiles (id) on delete set null,
  void_reason text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customer_payment_withholdings_invoice_idx
  on public.customer_payment_withholdings (company_id, invoice_id);
create index if not exists customer_payment_withholdings_payment_idx
  on public.customer_payment_withholdings (customer_payment_id);
create index if not exists customer_payment_withholdings_date_idx
  on public.customer_payment_withholdings (company_id, withholding_date);

do $do$
begin
  if not exists (select 1 from pg_trigger where tgname = 'set_updated_at' and tgrelid = 'public.customer_payment_withholdings'::regclass) then
    create trigger set_updated_at before update on public.customer_payment_withholdings
      for each row execute function public.set_updated_at();
  end if;
  if not exists (select 1 from pg_policies where tablename = 'customer_payment_withholdings' and policyname = 'customer_payment_withholdings_select') then
    create policy customer_payment_withholdings_select on public.customer_payment_withholdings
      for select using (
        company_id in (select public.user_company_ids())
        and (public.has_permission('payments.view') or public.has_permission('reports.view'))
      );
  end if;
end
$do$;

alter table public.customer_payment_withholdings enable row level security;
-- Sin políticas de escritura: solo se escribe con las funciones de abajo.
revoke all on public.customer_payment_withholdings from anon;
grant select on public.customer_payment_withholdings to authenticated;
grant all on public.customer_payment_withholdings to service_role;

comment on table public.customer_payment_withholdings is
  'Retenciones del cliente (ISR/ITBIS/Otra) aplicadas a una factura en un cobro. Inmutables salvo soporte y anulación.';

-- 3. Permiso para anular ---------------------------------------------------

insert into public.permissions (code, module, description) values
  ('payments.void', 'payments', 'Anular retenciones de clientes (y, más adelante, cobros y pagos)')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code = 'payments.void'
where r.company_id is null and r.name in ('ADMIN', 'FINANCE')
on conflict do nothing;

-- 4. register_customer_payment con retenciones ------------------------------

do $do$
begin
  if to_regprocedure('public.register_customer_payment(uuid, uuid, uuid, uuid, uuid, date, numeric, text, text, text, numeric, text, uuid, numeric, numeric, numeric, numeric, text, date, boolean, numeric)') is not null then
    alter function public.register_customer_payment(uuid, uuid, uuid, uuid, uuid, date, numeric, text, text, text, numeric, text, uuid, numeric, numeric, numeric, numeric, text, date, boolean, numeric)
      rename to register_customer_payment_old_077;
    revoke all on function public.register_customer_payment_old_077(uuid, uuid, uuid, uuid, uuid, date, numeric, text, text, text, numeric, text, uuid, numeric, numeric, numeric, numeric, text, date, boolean, numeric)
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
  p_rate_previous numeric default null,
  -- [{type, amount, date, certificate_number, certificate_amount, reference, notes, base_amount}]
  p_withholdings jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
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
  v_fee numeric := coalesce(p_bank_fee, 0);
  v_amount numeric := round(coalesce(p_amount, 0), 2);
  v_has_money boolean;
  v_w jsonb;
  v_w_type text;
  v_w_amount numeric;
  v_w_cert numeric;
  v_w_total numeric := 0;
  v_w_itbis numeric := 0;
  v_w_isr numeric := 0;
  v_applied numeric;
  v_prev_itbis numeric;
  v_prev_isr numeric;
  v_w_id uuid;
  v_w_count int := 0;
  -- Variable simple (no el record): con recibido 0 no se lee ninguna cuenta.
  v_acc_currency text;
begin
  if not public.has_permission('payments.create') then
    raise exception 'insufficient_privilege: falta el permiso payments.create';
  end if;
  if p_company_id not in (select * from public.user_company_ids()) then
    raise exception 'company_mismatch: no tienes acceso a esta compañía';
  end if;
  if p_category_id is not null and not exists (
    select 1 from public.expense_categories where id = p_category_id and company_id = p_company_id
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
  if v_amount < 0 then
    raise exception 'invalid_amount: el monto recibido no puede ser negativo';
  end if;
  if v_fee < 0 then
    raise exception 'invalid_amount: la comisión no puede ser negativa';
  end if;

  select c.base_currency into v_functional from public.companies c where c.id = p_company_id;

  -- Retenciones: validar todo antes de escribir.
  if p_withholdings is not null and jsonb_typeof(p_withholdings) <> 'array' then
    raise exception 'invalid_withholding: formato de retenciones inválido';
  end if;
  if p_withholdings is not null and jsonb_array_length(p_withholdings) > 10 then
    raise exception 'invalid_withholding: máximo 10 retenciones por cobro';
  end if;
  for v_w in select * from jsonb_array_elements(coalesce(p_withholdings, '[]'::jsonb)) loop
    v_w_type := upper(coalesce(v_w ->> 'type', ''));
    if v_w_type not in ('ISR', 'ITBIS', 'OTRO') then
      raise exception 'invalid_withholding: tipo de retención inválido (%)', v_w ->> 'type';
    end if;
    v_w_amount := round(coalesce((v_w ->> 'amount')::numeric, 0), 2);
    if v_w_amount <= 0 then
      raise exception 'invalid_withholding: cada retención debe tener un monto mayor a 0';
    end if;
    v_w_total := v_w_total + v_w_amount;
    if v_w_type = 'ITBIS' then v_w_itbis := v_w_itbis + v_w_amount; end if;
    if v_w_type = 'ISR' then v_w_isr := v_w_isr + v_w_amount; end if;
  end loop;

  v_applied := v_amount + v_w_total;
  if v_applied <= 0 then
    raise exception 'invalid_amount: el monto debe ser mayor a 0 (o agrega una retención)';
  end if;
  if v_applied > v_invoice.balance + 0.005 then
    raise exception 'amount_exceeds_balance: el dinero recibido más las retenciones (%) supera el balance pendiente (%)', v_applied, v_invoice.balance;
  end if;

  -- Sentido común (no son reglas fiscales): lo retenido acumulado no puede
  -- pasar del ITBIS de la factura ni el ISR de la base sin ITBIS.
  select coalesce(sum(amount) filter (where withholding_type = 'ITBIS'), 0),
         coalesce(sum(amount) filter (where withholding_type = 'ISR'), 0)
    into v_prev_itbis, v_prev_isr
    from public.customer_payment_withholdings
   where invoice_id = p_invoice_id and status = 'ACTIVE';
  if v_w_itbis > 0 and v_prev_itbis + v_w_itbis > v_invoice.tax + 0.005 then
    raise exception 'itbis_withholding_exceeds_tax: el ITBIS retenido (%) supera el ITBIS de la factura (%)', v_prev_itbis + v_w_itbis, v_invoice.tax;
  end if;
  if v_w_isr > 0 and v_prev_isr + v_w_isr > (v_invoice.total - v_invoice.tax) + 0.005 then
    raise exception 'isr_withholding_exceeds_base: el ISR retenido (%) supera la base de la factura sin ITBIS (%)', v_prev_isr + v_w_isr, v_invoice.total - v_invoice.tax;
  end if;

  v_has_money := v_amount > 0;

  if v_has_money then
    if p_bank_account_id is null then
      raise exception 'bank_account_required: debes elegir la cuenta bancaria donde se recibió el cobro';
    end if;
    select * into v_bank_account from public.bank_accounts where id = p_bank_account_id;
    if not found or v_bank_account.company_id <> p_company_id then
      raise exception 'account_not_found: la cuenta bancaria no existe o no pertenece a esta compañía';
    end if;
    if v_bank_account.type = 'CREDIT_CARD' then
      raise exception 'invalid_account_type: no se puede recibir un cobro de cliente en una tarjeta de crédito';
    end if;

    select s.rounding_tolerance into v_tolerance from public.currency_settings s where s.company_id = p_company_id;
    v_tolerance := coalesce(v_tolerance, 1);
    v_acc_currency := v_bank_account.currency;
    v_multi := v_acc_currency <> v_invoice.currency;

    if v_multi then
      -- Solo la parte en DINERO entra en la tasa efectiva y la diferencia.
      select f.effective_rate, f.effective_rate_currency, f.functional_amount, f.rounding_difference, f.informative_difference, f.account_rate
        into v_fx_eff, v_fx_eff_cur, v_fx_func, v_fx_round, v_fx_info, v_fx_acc
        from public.fx_settlement('COBRO', v_invoice.currency, v_bank_account.currency, v_functional,
        v_amount, p_account_amount, p_reference_rate, p_reference_rate_document, v_tolerance) f;
      v_bank_amount := p_account_amount;
      v_bank_rate := v_fx_acc;
      v_functional_amount := v_fx_func;
    else
      if p_account_amount is not null and p_account_amount <> v_amount then
        raise exception 'invalid_amount: misma moneda, el monto del banco debe ser igual al cobrado';
      end if;
      v_bank_amount := v_amount;
      v_bank_rate := coalesce(p_exchange_rate, 1);
      v_functional_amount := case
        when v_bank_account.currency = v_functional then v_amount
        when coalesce(p_reference_rate, 0) > 0 then round(v_amount * p_reference_rate, 2)
        else round(v_amount * coalesce(p_exchange_rate, 1), 2)
      end;
    end if;

    if v_fee >= v_bank_amount then
      raise exception 'invalid_amount: la comisión no puede ser igual o mayor que lo que entró al banco';
    end if;
  else
    -- Solo retención: no entra dinero, no hay cuenta ni movimiento de banco.
    if v_w_total <= 0 then
      raise exception 'invalid_amount: el monto debe ser mayor a 0';
    end if;
    if v_fee > 0 then
      raise exception 'invalid_amount: sin dinero recibido no puede haber comisión del banco';
    end if;
  end if;

  insert into public.customer_payments (
    company_id, client_id, invoice_id, project_id, bank_account_id,
    payment_date, amount, withholding_total, method, reference, currency, exchange_rate, notes,
    created_by,
    account_currency, account_amount, bank_fee_amount, functional_currency, functional_amount,
    effective_rate, effective_rate_currency, reference_rate, reference_rate_document,
    reference_rate_source, rate_date, rate_manual_override, rate_overridden_by, rate_previous,
    rounding_difference, informative_difference
  ) values (
    p_company_id, p_client_id, p_invoice_id, p_project_id,
    case when v_has_money then p_bank_account_id end,
    p_payment_date, v_amount, v_w_total, p_method, p_reference, v_invoice.currency,
    coalesce(p_exchange_rate, v_invoice.exchange_rate), p_notes,
    v_user_id,
    v_acc_currency,
    case when v_has_money then v_bank_amount end,
    nullif(v_fee, 0), v_functional,
    case when v_has_money then v_functional_amount else 0 end,
    case when v_multi then v_fx_eff end,
    case when v_multi then v_fx_eff_cur end,
    case when v_has_money then p_reference_rate end,
    case when v_has_money then p_reference_rate_document end,
    case when v_has_money then p_reference_rate_source end,
    case when v_has_money then coalesce(p_rate_date, case when v_multi then p_payment_date end) end,
    v_has_money and coalesce(p_rate_manual_override, false),
    case when v_has_money and coalesce(p_rate_manual_override, false) then v_user_id end,
    case when v_has_money then p_rate_previous end,
    case when v_multi then v_fx_round else 0 end,
    case when v_multi then v_fx_info else 0 end
  )
  returning id into v_payment_id;

  for v_w in select * from jsonb_array_elements(coalesce(p_withholdings, '[]'::jsonb)) loop
    v_w_type := upper(v_w ->> 'type');
    v_w_amount := round((v_w ->> 'amount')::numeric, 2);
    -- Certificado DGII en pesos: en facturas en la moneda funcional es el
    -- mismo monto; en otra moneda, lo que escribió el usuario (opcional).
    v_w_cert := case
      when v_invoice.currency = v_functional then v_w_amount
      else nullif(round(coalesce((v_w ->> 'certificate_amount')::numeric, 0), 2), 0)
    end;
    insert into public.customer_payment_withholdings (
      company_id, customer_payment_id, invoice_id, client_id, withholding_type, amount, currency,
      certificate_amount, certificate_currency, base_amount, withholding_date,
      certificate_number, reference, notes, created_by
    ) values (
      p_company_id, v_payment_id, p_invoice_id, v_invoice.client_id, v_w_type, v_w_amount, v_invoice.currency,
      v_w_cert, case when v_w_cert is not null then v_functional end,
      nullif(round(coalesce((v_w ->> 'base_amount')::numeric, 0), 2), 0),
      coalesce(nullif(v_w ->> 'date', '')::date, p_payment_date),
      nullif(trim(v_w ->> 'certificate_number'), ''),
      nullif(trim(v_w ->> 'reference'), ''),
      nullif(trim(v_w ->> 'notes'), ''),
      v_user_id
    )
    returning id into v_w_id;
    v_w_count := v_w_count + 1;

    insert into public.audit_logs (company_id, user_id, action, entity_type, entity_id, new_values)
    values (
      p_company_id, v_user_id, 'CREATE', 'customer_withholding', v_w_id,
      jsonb_build_object(
        'invoice_id', p_invoice_id, 'customer_payment_id', v_payment_id, 'client_id', v_invoice.client_id,
        'type', v_w_type, 'amount', v_w_amount, 'currency', v_invoice.currency,
        'certificate_amount', v_w_cert, 'certificate_number', nullif(trim(v_w ->> 'certificate_number'), '')
      )
    );
  end loop;

  v_new_paid := v_invoice.paid_amount + v_applied;
  v_new_balance := v_invoice.total - v_new_paid;
  v_new_status := case when v_new_balance <= 0.005 then 'PAID' else 'PARTIALLY_PAID' end;

  update public.invoices
     set paid_amount = v_new_paid,
         withholding_total = withholding_total + v_w_total,
         balance = greatest(0, round(v_new_balance, 2)),
         status = v_new_status
   where id = p_invoice_id;

  if v_has_money then
    -- El banco se mueve SOLO con el dinero, en la moneda de la cuenta.
    insert into public.bank_transactions (
      company_id, bank_account_id, project_id, client_id, customer_payment_id,
      type, amount, currency, exchange_rate, transaction_date, description, category_id
    ) values (
      p_company_id, p_bank_account_id, p_project_id, p_client_id, v_payment_id,
      'INCOME', v_bank_amount, v_bank_account.currency, v_bank_rate, p_payment_date,
      'Cobro factura ' || v_invoice.number, p_category_id
    );

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
        true
      );
    end if;
  end if;

  insert into public.audit_logs (company_id, user_id, action, entity_type, entity_id, new_values)
  values (
    p_company_id, v_user_id, 'CREATE', 'customer_payment', v_payment_id,
    jsonb_build_object(
      'invoice_id', p_invoice_id, 'amount_received', v_amount, 'withholding_total', v_w_total,
      'amount_applied', v_applied, 'withholdings', v_w_count, 'method', p_method,
      'new_invoice_status', v_new_status, 'category_id', p_category_id,
      'account_currency', v_acc_currency,
      'account_amount', case when v_has_money then v_bank_amount end,
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
$function$;

revoke all on function public.register_customer_payment(uuid, uuid, uuid, uuid, uuid, date, numeric, text, text, text, numeric, text, uuid, numeric, numeric, numeric, numeric, text, date, boolean, numeric, jsonb) from public, anon;
grant execute on function public.register_customer_payment(uuid, uuid, uuid, uuid, uuid, date, numeric, text, text, text, numeric, text, uuid, numeric, numeric, numeric, numeric, text, date, boolean, numeric, jsonb) to authenticated;

-- 5. Agregar certificado / soporte después (sin tocar montos) ----------------

create or replace function public.update_customer_withholding_support(
  p_withholding_id uuid,
  p_certificate_number text default null,
  p_certificate_amount numeric default null,
  p_reference text default null,
  p_notes text default null,
  p_document_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_w record;
  v_functional text;
  v_new_cert numeric;
  v_user_id uuid := auth.uid();
begin
  if not public.has_permission('payments.create') then
    raise exception 'insufficient_privilege: falta el permiso payments.create';
  end if;
  select * into v_w from public.customer_payment_withholdings where id = p_withholding_id for update;
  if not found or v_w.company_id not in (select * from public.user_company_ids()) then
    raise exception 'withholding_not_found: la retención no existe';
  end if;
  if v_w.status <> 'ACTIVE' then
    raise exception 'invalid_status: la retención está anulada';
  end if;
  if p_document_id is not null and not exists (
    select 1 from public.documents where id = p_document_id and company_id = v_w.company_id
  ) then
    raise exception 'document_not_found: el documento no existe';
  end if;
  if p_certificate_amount is not null and p_certificate_amount <= 0 then
    raise exception 'invalid_amount: el monto del certificado debe ser mayor a 0';
  end if;

  select c.base_currency into v_functional from public.companies c where c.id = v_w.company_id;
  -- En facturas en pesos el monto del certificado es el de la retención.
  v_new_cert := case
    when v_w.currency = v_functional then v_w.amount
    else coalesce(round(p_certificate_amount, 2), v_w.certificate_amount)
  end;

  update public.customer_payment_withholdings
     set certificate_number = coalesce(nullif(trim(p_certificate_number), ''), certificate_number),
         certificate_amount = v_new_cert,
         certificate_currency = case when v_new_cert is not null then v_functional end,
         reference = coalesce(nullif(trim(p_reference), ''), reference),
         notes = coalesce(nullif(trim(p_notes), ''), notes),
         document_id = coalesce(p_document_id, document_id)
   where id = p_withholding_id;

  insert into public.audit_logs (company_id, user_id, action, entity_type, entity_id, old_values, new_values)
  values (
    v_w.company_id, v_user_id, 'UPDATE_SUPPORT', 'customer_withholding', p_withholding_id,
    jsonb_build_object('certificate_number', v_w.certificate_number, 'certificate_amount', v_w.certificate_amount,
      'reference', v_w.reference, 'notes', v_w.notes, 'document_id', v_w.document_id),
    jsonb_build_object('certificate_number', coalesce(nullif(trim(p_certificate_number), ''), v_w.certificate_number),
      'certificate_amount', v_new_cert,
      'reference', coalesce(nullif(trim(p_reference), ''), v_w.reference),
      'notes', coalesce(nullif(trim(p_notes), ''), v_w.notes),
      'document_id', coalesce(p_document_id, v_w.document_id))
  );
end;
$function$;

revoke all on function public.update_customer_withholding_support(uuid, text, numeric, text, text, uuid) from public, anon;
grant execute on function public.update_customer_withholding_support(uuid, text, numeric, text, text, uuid) to authenticated;

-- 6. Anular una retención (nunca se borra) -----------------------------------

create or replace function public.void_customer_withholding(
  p_withholding_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_w record;
  v_invoice record;
  v_new_paid numeric;
  v_new_balance numeric;
  v_new_status text;
  v_user_id uuid := auth.uid();
begin
  if not public.has_permission('payments.void') then
    raise exception 'insufficient_privilege: falta el permiso payments.void';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 10 then
    raise exception 'reason_required: escribe el motivo de la anulación (mínimo 10 letras)';
  end if;
  select * into v_w from public.customer_payment_withholdings where id = p_withholding_id for update;
  if not found or v_w.company_id not in (select * from public.user_company_ids()) then
    raise exception 'withholding_not_found: la retención no existe';
  end if;
  if v_w.status <> 'ACTIVE' then
    raise exception 'invalid_status: la retención ya está anulada';
  end if;

  select * into v_invoice from public.invoices where id = v_w.invoice_id for update;
  if v_invoice.status = 'CANCELLED' then
    raise exception 'invalid_status: la factura está cancelada';
  end if;

  update public.customer_payment_withholdings
     set status = 'VOIDED', voided_at = now(), voided_by = v_user_id, void_reason = trim(p_reason)
   where id = p_withholding_id;

  update public.customer_payments
     set withholding_total = greatest(0, withholding_total - v_w.amount)
   where id = v_w.customer_payment_id;

  v_new_paid := greatest(0, v_invoice.paid_amount - v_w.amount);
  v_new_balance := v_invoice.total - v_new_paid;
  v_new_status := case
    when v_new_balance <= 0.005 then 'PAID'
    when v_new_paid <= 0 then 'ISSUED'
    else 'PARTIALLY_PAID'
  end;

  update public.invoices
     set paid_amount = v_new_paid,
         withholding_total = greatest(0, withholding_total - v_w.amount),
         balance = greatest(0, round(v_new_balance, 2)),
         status = v_new_status
   where id = v_w.invoice_id;

  -- El banco no se toca: la retención nunca movió dinero.
  insert into public.audit_logs (company_id, user_id, action, entity_type, entity_id, old_values, new_values)
  values (
    v_w.company_id, v_user_id, 'VOID', 'customer_withholding', p_withholding_id,
    jsonb_build_object('status', 'ACTIVE', 'amount', v_w.amount, 'type', v_w.withholding_type,
      'invoice_paid_amount', v_invoice.paid_amount, 'invoice_balance', v_invoice.balance, 'invoice_status', v_invoice.status),
    jsonb_build_object('status', 'VOIDED', 'reason', trim(p_reason),
      'invoice_paid_amount', v_new_paid, 'invoice_balance', greatest(0, round(v_new_balance, 2)), 'invoice_status', v_new_status)
  );
end;
$function$;

revoke all on function public.void_customer_withholding(uuid, text) from public, anon;
grant execute on function public.void_customer_withholding(uuid, text) to authenticated;

-- 7. (Opcional, lo pega el usuario en el SQL Editor cuando quiera limpiar)
-- drop function if exists public.register_customer_payment_old_077(uuid, uuid, uuid, uuid, uuid, date, numeric, text, text, text, numeric, text, uuid, numeric, numeric, numeric, numeric, text, date, boolean, numeric);
