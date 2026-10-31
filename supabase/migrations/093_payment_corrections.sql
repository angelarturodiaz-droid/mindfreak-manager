-- 093 — V1-4 Correcciones de cobros, pagos y movimientos manuales con doble aprobación.
--
-- Regla de oro: nada se borra. Anular = marcar el registro como ANULADO y crear
-- en el banco un movimiento «Reverso» del mismo monto en sentido contrario.
-- Corregir monto o cuenta = anular + registrar de nuevo (con las mismas
-- funciones de siempre: register_customer_payment / register_supplier_payment).
-- Corregir fecha, referencia o descripción = cambio en el mismo registro.
--
-- Doble aprobación: quien pide (payments.create) nunca aprueba; aprueba otra
-- persona con payments.void (Administración o Finanzas). Mientras está
-- pendiente no cambia nada. Todo queda en audit_logs con antes/después.
--
-- No toca el motor fiscal, las reglas de retención, net_payable ni el
-- snapshot fiscal del gasto: un pago anulado solo deja de contar como pagado.

-- ---------------------------------------------------------------------------
-- 1. Columnas nuevas
-- ---------------------------------------------------------------------------
alter table public.customer_payments
  add column if not exists status text not null default 'ACTIVE',
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid references auth.users(id),
  add column if not exists void_reason text,
  add column if not exists replaces_payment_id uuid references public.customer_payments(id);
alter table public.customer_payments drop constraint if exists customer_payments_status_check;
alter table public.customer_payments add constraint customer_payments_status_check check (status in ('ACTIVE', 'VOIDED'));

alter table public.supplier_payments
  add column if not exists status text not null default 'ACTIVE',
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid references auth.users(id),
  add column if not exists void_reason text,
  add column if not exists replaces_payment_id uuid references public.supplier_payments(id);
alter table public.supplier_payments drop constraint if exists supplier_payments_status_check;
alter table public.supplier_payments add constraint supplier_payments_status_check check (status in ('ACTIVE', 'VOIDED'));

alter table public.bank_transactions
  add column if not exists reverses_transaction_id uuid references public.bank_transactions(id),
  add column if not exists voided_at timestamptz,
  add column if not exists void_reason text;

create index if not exists idx_bank_transactions_reverses on public.bank_transactions(reverses_transaction_id)
  where reverses_transaction_id is not null;

-- ---------------------------------------------------------------------------
-- 2. Solicitudes de corrección
-- ---------------------------------------------------------------------------
create table if not exists public.payment_correction_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  target_type text not null check (target_type in ('customer_payment', 'supplier_payment', 'bank_transaction')),
  target_id uuid not null,
  target_label text not null,
  action text not null check (action in ('CHANGE', 'VOID')),
  old_values jsonb not null default '{}'::jsonb,
  new_values jsonb not null default '{}'::jsonb,
  reason text not null,
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN')),
  requested_by uuid not null references auth.users(id),
  requested_at timestamptz not null default now(),
  decided_by uuid references auth.users(id),
  decided_at timestamptz,
  decision_note text,
  result jsonb,
  -- Para enlazar desde la lista: la factura, el gasto o la cuenta del registro.
  link_type text,
  link_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_payment_correction_pending
  on public.payment_correction_requests(target_type, target_id) where status = 'PENDING';
create index if not exists idx_payment_correction_company_status
  on public.payment_correction_requests(company_id, status, requested_at desc);

drop trigger if exists set_updated_at on public.payment_correction_requests;
create trigger set_updated_at before update on public.payment_correction_requests
  for each row execute function public.set_updated_at();

alter table public.payment_correction_requests enable row level security;
drop policy if exists payment_correction_requests_select on public.payment_correction_requests;
create policy payment_correction_requests_select on public.payment_correction_requests
  for select to authenticated
  using (
    company_id in (select public.user_company_ids())
    and (public.has_permission('payments.view') or requested_by = auth.uid())
  );
-- Sin políticas de escritura: solo se escribe con las funciones de abajo.
revoke insert, update, delete on public.payment_correction_requests from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Protección: un movimiento conciliado no cambia monto, tipo, cuenta ni fecha
-- ---------------------------------------------------------------------------
create or replace function public.guard_reconciled_bank_transaction()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.reconciled and new.reconciled and (
    new.amount is distinct from old.amount
    or new.type is distinct from old.type
    or new.bank_account_id is distinct from old.bank_account_id
    or new.transaction_date is distinct from old.transaction_date
  ) then
    raise exception 'reconciled_locked: Este movimiento está conciliado: quítale la marca de conciliado en Bancos antes de corregirlo.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_bank_transaction_reconciled_guard on public.bank_transactions;
create trigger trg_bank_transaction_reconciled_guard
  before update on public.bank_transactions
  for each row execute function public.guard_reconciled_bank_transaction();

-- ---------------------------------------------------------------------------
-- 4. Ayudantes internos (no se exponen a la app)
-- ---------------------------------------------------------------------------

-- Movimientos de banco que pertenecen a un registro (el principal + su comisión).
create or replace function public.mf_payment_bank_rows(p_target_type text, p_target_id uuid)
returns setof public.bank_transactions
language sql
stable
security definer
set search_path = public
as $$
  select t.* from public.bank_transactions t
   where t.voided_at is null and t.reverses_transaction_id is null
     and (
       (p_target_type = 'customer_payment' and (t.customer_payment_id = p_target_id
          or (t.related_source_type = 'customer_payment' and t.related_source_id = p_target_id)))
       or (p_target_type = 'supplier_payment' and (t.supplier_payment_id = p_target_id
          or (t.related_source_type = 'supplier_payment' and t.related_source_id = p_target_id)))
       or (p_target_type = 'bank_transaction' and t.id = p_target_id)
     );
$$;

-- Crea el reverso de un movimiento (mismo monto, sentido contrario, fecha de hoy)
-- y marca el original como anulado. Devuelve el id del reverso.
create or replace function public.mf_reverse_bank_transaction(p_tx_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = public
set "TimeZone" to 'America/Santo_Domingo'
as $$
declare
  v_tx record;
  v_id uuid;
begin
  select * into v_tx from public.bank_transactions where id = p_tx_id for update;
  if not found then
    raise exception 'transaction_not_found: el movimiento no existe';
  end if;
  if v_tx.reconciled then
    raise exception 'reconciled_locked: Este movimiento está conciliado: quítale la marca de conciliado en Bancos antes de corregirlo.';
  end if;
  if v_tx.voided_at is not null then
    return null;
  end if;
  insert into public.bank_transactions (
    company_id, bank_account_id, project_id, client_id, supplier_id,
    type, amount, currency, exchange_rate, transaction_date, description, category_id,
    reference, overdraft_confirmed, reverses_transaction_id
  ) values (
    v_tx.company_id, v_tx.bank_account_id, v_tx.project_id, v_tx.client_id, v_tx.supplier_id,
    case v_tx.type when 'INCOME' then 'EXPENSE' else 'INCOME' end,
    v_tx.amount, v_tx.currency, v_tx.exchange_rate, current_date,
    'Reverso — ' || v_tx.description, v_tx.category_id,
    v_tx.reference, true, v_tx.id
  )
  returning id into v_id;
  update public.bank_transactions
     set voided_at = now(), void_reason = trim(p_reason)
   where id = v_tx.id;
  return v_id;
end;
$$;

-- Anula un cobro: retenciones del cobro anuladas, reverso en el banco y la
-- factura vuelve a deber lo que ese cobro había rebajado.
create or replace function public.mf_void_customer_payment(p_payment_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pay record;
  v_inv record;
  v_applied numeric;
  v_new_paid numeric;
  v_new_balance numeric;
  v_new_status text;
  v_tx record;
  v_user uuid := auth.uid();
begin
  select * into v_pay from public.customer_payments where id = p_payment_id for update;
  if not found or v_pay.status <> 'ACTIVE' then
    raise exception 'invalid_status: el cobro ya está anulado o no existe';
  end if;
  select * into v_inv from public.invoices where id = v_pay.invoice_id for update;
  if v_inv.status = 'CANCELLED' then
    raise exception 'invalid_status: la factura está cancelada';
  end if;

  update public.customer_payment_withholdings
     set status = 'VOIDED', voided_at = now(), voided_by = v_user, void_reason = 'Cobro anulado: ' || trim(p_reason)
   where customer_payment_id = p_payment_id and status = 'ACTIVE';

  v_applied := coalesce(v_pay.amount, 0) + coalesce(v_pay.withholding_total, 0);
  v_new_paid := greatest(0, v_inv.paid_amount - v_applied);
  v_new_balance := v_inv.total - v_new_paid;
  v_new_status := case
    when v_new_balance <= 0.005 then 'PAID'
    when v_new_paid <= 0.005 then 'ISSUED'
    else 'PARTIALLY_PAID'
  end;
  update public.invoices
     set paid_amount = v_new_paid,
         withholding_total = greatest(0, withholding_total - coalesce(v_pay.withholding_total, 0)),
         balance = greatest(0, round(v_new_balance, 2)),
         status = v_new_status
   where id = v_inv.id;

  for v_tx in select * from public.mf_payment_bank_rows('customer_payment', p_payment_id) loop
    perform public.mf_reverse_bank_transaction(v_tx.id, p_reason);
  end loop;

  update public.customer_payments
     set status = 'VOIDED', voided_at = now(), voided_by = v_user, void_reason = trim(p_reason)
   where id = p_payment_id;

  insert into public.audit_logs (company_id, user_id, action, entity_type, entity_id, old_values, new_values)
  values (
    v_pay.company_id, v_user, 'VOID', 'customer_payment', p_payment_id,
    jsonb_build_object('status', 'ACTIVE', 'amount', v_pay.amount, 'withholding_total', v_pay.withholding_total,
      'invoice_balance', v_inv.balance, 'invoice_status', v_inv.status),
    jsonb_build_object('status', 'VOIDED', 'reason', trim(p_reason),
      'invoice_balance', greatest(0, round(v_new_balance, 2)), 'invoice_status', v_new_status)
  );
end;
$$;

-- Anula un pago a proveedor: reverso en el banco (o en la tarjeta) y el gasto
-- vuelve a deber. No toca retenciones ni net_payable (siguen en el gasto).
create or replace function public.mf_void_supplier_payment(p_payment_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pay record;
  v_exp record;
  v_new_paid numeric;
  v_new_balance numeric;
  v_new_status text;
  v_tx record;
  v_user uuid := auth.uid();
begin
  select * into v_pay from public.supplier_payments where id = p_payment_id for update;
  if not found or v_pay.status <> 'ACTIVE' then
    raise exception 'invalid_status: el pago ya está anulado o no existe';
  end if;
  select * into v_exp from public.expenses where id = v_pay.expense_id for update;
  if v_exp.status = 'CANCELLED' then
    raise exception 'invalid_status: el gasto está cancelado';
  end if;

  v_new_paid := greatest(0, v_exp.paid_amount - v_pay.amount);
  v_new_balance := coalesce(v_exp.net_payable, v_exp.total) - v_new_paid;
  v_new_status := case
    when v_new_balance <= 0.005 then 'PAID'
    when v_new_paid <= 0.005 then 'PENDING'
    else 'PARTIALLY_PAID'
  end;
  update public.expenses
     set paid_amount = v_new_paid,
         balance = greatest(0, round(v_new_balance, 2)),
         status = v_new_status
   where id = v_exp.id;

  for v_tx in select * from public.mf_payment_bank_rows('supplier_payment', p_payment_id) loop
    perform public.mf_reverse_bank_transaction(v_tx.id, p_reason);
  end loop;

  update public.supplier_payments
     set status = 'VOIDED', voided_at = now(), voided_by = v_user, void_reason = trim(p_reason)
   where id = p_payment_id;

  insert into public.audit_logs (company_id, user_id, action, entity_type, entity_id, old_values, new_values)
  values (
    v_pay.company_id, v_user, 'VOID', 'supplier_payment', p_payment_id,
    jsonb_build_object('status', 'ACTIVE', 'amount', v_pay.amount,
      'expense_balance', v_exp.balance, 'expense_status', v_exp.status),
    jsonb_build_object('status', 'VOIDED', 'reason', trim(p_reason),
      'expense_balance', greatest(0, round(v_new_balance, 2)), 'expense_status', v_new_status)
  );
end;
$$;

-- Avisos en la campanita a quienes pueden aprobar (menos quien pidió).
create or replace function public.mf_notify_correction_approvers(p_company_id uuid, p_request_id uuid, p_except uuid, p_title text, p_message text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.notifications (company_id, user_id, type, title, message, entity_type, entity_id)
  select distinct p_company_id, ur.user_id, 'correction_request', p_title, p_message, 'payment_correction', p_request_id
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.permissions p on p.id = rp.permission_id and p.code = 'payments.void'
    join public.profiles pr on pr.id = ur.user_id and pr.is_active
   where ur.company_id = p_company_id and ur.user_id <> p_except;
$$;

revoke execute on function public.mf_payment_bank_rows(text, uuid) from public, anon, authenticated;
revoke execute on function public.mf_reverse_bank_transaction(uuid, text) from public, anon, authenticated;
revoke execute on function public.mf_void_customer_payment(uuid, text) from public, anon, authenticated;
revoke execute on function public.mf_void_supplier_payment(uuid, text) from public, anon, authenticated;
revoke execute on function public.mf_notify_correction_approvers(uuid, uuid, uuid, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Pedir una corrección
-- ---------------------------------------------------------------------------
-- p_new (solo para CHANGE): {"amount", "date", "bank_account_id", "reference", "description"}.
create or replace function public.request_payment_correction(
  p_target_type text,
  p_target_id uuid,
  p_action text,
  p_new jsonb,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
set "TimeZone" to 'America/Santo_Domingo'
as $$
declare
  v_user uuid := auth.uid();
  v_company uuid;
  v_label text;
  v_old jsonb;
  v_new jsonb := '{}'::jsonb;
  v_status text;
  v_amount numeric;
  v_date date;
  v_account uuid;
  v_reference text;
  v_description text;
  v_doc_currency text;
  v_acc_currency text;
  v_withholdings numeric := 0;
  v_doc_balance numeric;
  v_new_account record;
  v_link_type text;
  v_link_id uuid;
  v_id uuid;
  v_changed boolean := false;
  v_money_change boolean := false;
  v_tx record;
begin
  if not public.has_permission('payments.create') then
    raise exception 'insufficient_privilege: no tienes permiso para pedir correcciones';
  end if;
  if p_action not in ('CHANGE', 'VOID') then
    raise exception 'invalid_action: elige corregir o anular';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 10 then
    raise exception 'reason_required: escribe el motivo (mínimo 10 letras), ej. «Se digitó un cero de más»';
  end if;

  if p_target_type = 'customer_payment' then
    select cp.company_id, cp.status, cp.amount, cp.payment_date, cp.bank_account_id, cp.reference,
           cp.currency, coalesce(cp.account_currency, cp.currency), coalesce(cp.withholding_total, 0),
           'Cobro ' || i.number || ' — ' || coalesce(c.name, ''), i.balance, 'invoice', i.id
      into v_company, v_status, v_amount, v_date, v_account, v_reference,
           v_doc_currency, v_acc_currency, v_withholdings, v_label, v_doc_balance, v_link_type, v_link_id
      from public.customer_payments cp
      join public.invoices i on i.id = cp.invoice_id
      left join public.clients c on c.id = cp.client_id
     where cp.id = p_target_id;
  elsif p_target_type = 'supplier_payment' then
    select sp.company_id, sp.status, sp.amount, sp.payment_date, sp.bank_account_id, sp.reference,
           sp.currency, coalesce(sp.account_currency, sp.currency),
           'Pago — ' || e.description || coalesce(' — ' || s.name, ''), e.balance, 'expense', e.id
      into v_company, v_status, v_amount, v_date, v_account, v_reference,
           v_doc_currency, v_acc_currency, v_label, v_doc_balance, v_link_type, v_link_id
      from public.supplier_payments sp
      join public.expenses e on e.id = sp.expense_id
      left join public.suppliers s on s.id = sp.supplier_id
     where sp.id = p_target_id;
  elsif p_target_type = 'bank_transaction' then
    select t.company_id, case when t.voided_at is null then 'ACTIVE' else 'VOIDED' end, t.amount, t.transaction_date,
           t.bank_account_id, t.reference, t.description, t.currency, t.currency,
           'Movimiento — ' || t.description, 'bank_account', t.bank_account_id
      into v_company, v_status, v_amount, v_date, v_account, v_reference, v_description,
           v_doc_currency, v_acc_currency, v_label, v_link_type, v_link_id
      from public.bank_transactions t
     where t.id = p_target_id
       and t.customer_payment_id is null and t.supplier_payment_id is null and t.expense_id is null
       and t.transfer_group_id is null and t.customer_advance_id is null and t.related_source_id is null
       and t.reverses_transaction_id is null and t.system_concept is null;
    if v_company is null then
      raise exception 'not_manual: este movimiento viene de un cobro, pago, transferencia o anticipo: corrígelo desde su origen';
    end if;
  else
    raise exception 'invalid_target: tipo de registro no válido';
  end if;

  if v_company is null or v_company not in (select public.user_company_ids()) then
    raise exception 'not_found: el registro no existe';
  end if;
  if v_status <> 'ACTIVE' then
    raise exception 'already_voided: este registro ya está anulado';
  end if;
  if exists (select 1 from public.payment_correction_requests
              where target_type = p_target_type and target_id = p_target_id and status = 'PENDING') then
    raise exception 'already_pending: ya hay una corrección pendiente para este registro; espera a que la aprueben o retírala';
  end if;
  for v_tx in select * from public.mf_payment_bank_rows(p_target_type, p_target_id) loop
    if v_tx.reconciled then
      raise exception 'reconciled_locked: Este movimiento está conciliado: quítale la marca de conciliado en Bancos antes de pedir la corrección.';
    end if;
  end loop;

  v_old := jsonb_build_object(
    'amount', v_amount, 'date', v_date, 'bank_account_id', v_account,
    'bank_account_name', (select name from public.bank_accounts where id = v_account),
    'reference', v_reference, 'description', v_description,
    'currency', v_doc_currency, 'account_currency', v_acc_currency
  );

  if p_action = 'CHANGE' then
    if p_new ? 'amount' and nullif(p_new ->> 'amount', '') is not null
       and round((p_new ->> 'amount')::numeric, 2) <> round(v_amount, 2) then
      if round((p_new ->> 'amount')::numeric, 2) <= 0 then
        raise exception 'invalid_amount: el monto nuevo debe ser mayor a 0';
      end if;
      if v_withholdings > 0 then
        raise exception 'has_withholdings: este cobro tiene retenciones del cliente: para cambiar el monto pide «Anular» y regístralo de nuevo';
      end if;
      if p_target_type <> 'bank_transaction'
         and round((p_new ->> 'amount')::numeric, 2) > coalesce(v_doc_balance, 0) + v_amount + 0.005 then
        raise exception 'amount_exceeds_balance: el monto nuevo es mayor de lo que se debe en el documento (%)',
          public.format_money_text(coalesce(v_doc_balance, 0) + v_amount, v_doc_currency);
      end if;
      v_new := v_new || jsonb_build_object('amount', round((p_new ->> 'amount')::numeric, 2));
      v_money_change := true;
    end if;
    if p_new ? 'bank_account_id' and nullif(p_new ->> 'bank_account_id', '') is not null
       and (p_new ->> 'bank_account_id')::uuid is distinct from v_account then
      select * into v_new_account from public.bank_accounts where id = (p_new ->> 'bank_account_id')::uuid;
      if not found or v_new_account.company_id <> v_company or not v_new_account.is_active then
        raise exception 'account_not_found: la cuenta nueva no existe o está inactiva';
      end if;
      if v_new_account.currency <> v_acc_currency then
        raise exception 'currency_mismatch: la cuenta nueva está en % y la original en %: pide «Anular» y regístralo de nuevo en la cuenta correcta',
          v_new_account.currency, v_acc_currency;
      end if;
      if p_target_type = 'customer_payment' and v_new_account.type = 'CREDIT_CARD' then
        raise exception 'invalid_account_type: un cobro no puede entrar a una tarjeta de crédito';
      end if;
      v_new := v_new || jsonb_build_object('bank_account_id', v_new_account.id, 'bank_account_name', v_new_account.name);
      v_money_change := true;
    end if;
    if v_money_change and p_target_type <> 'bank_transaction' and v_acc_currency <> v_doc_currency then
      raise exception 'multi_currency: este registro se hizo en otra moneda: para cambiar monto o cuenta pide «Anular» y regístralo de nuevo';
    end if;
    if p_new ? 'date' and nullif(p_new ->> 'date', '') is not null and (p_new ->> 'date')::date <> v_date then
      if (p_new ->> 'date')::date > current_date then
        raise exception 'invalid_date: la fecha no puede ser futura';
      end if;
      v_new := v_new || jsonb_build_object('date', (p_new ->> 'date')::date);
    end if;
    if p_new ? 'reference' and coalesce(trim(p_new ->> 'reference'), '') is distinct from coalesce(v_reference, '') then
      v_new := v_new || jsonb_build_object('reference', nullif(trim(p_new ->> 'reference'), ''));
    end if;
    if p_target_type = 'bank_transaction' and p_new ? 'description'
       and coalesce(trim(p_new ->> 'description'), '') <> '' and trim(p_new ->> 'description') <> coalesce(v_description, '') then
      v_new := v_new || jsonb_build_object('description', trim(p_new ->> 'description'));
    end if;
    v_changed := v_new <> '{}'::jsonb;
    if not v_changed then
      raise exception 'no_changes: no cambiaste ningún dato; escribe el valor correcto o elige «Anular»';
    end if;
  end if;

  insert into public.payment_correction_requests (
    company_id, target_type, target_id, target_label, action, old_values, new_values, reason,
    requested_by, link_type, link_id
  ) values (
    v_company, p_target_type, p_target_id, v_label, p_action, v_old, v_new, trim(p_reason),
    v_user, v_link_type, v_link_id
  )
  returning id into v_id;

  insert into public.audit_logs (company_id, user_id, action, entity_type, entity_id, old_values, new_values)
  values (v_company, v_user, 'CORRECTION_REQUEST', p_target_type, p_target_id, v_old,
    jsonb_build_object('request_id', v_id, 'action', p_action, 'changes', v_new, 'reason', trim(p_reason)));

  perform public.mf_notify_correction_approvers(
    v_company, v_id, v_user,
    case when p_action = 'VOID' then 'Anulación por aprobar' else 'Corrección por aprobar' end,
    v_label || ' · ' || trim(p_reason)
  );

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Aprobar (aplica el cambio), rechazar o retirar
-- ---------------------------------------------------------------------------
create or replace function public.approve_payment_correction(p_request_id uuid, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
set "TimeZone" to 'America/Santo_Domingo'
as $$
declare
  v_user uuid := auth.uid();
  v_req record;
  v_new jsonb;
  v_reason text;
  v_result jsonb := '{}'::jsonb;
  v_cp record;
  v_sp record;
  v_tx record;
  v_new_id uuid;
  v_category uuid;
  v_money boolean;
  v_date date;
  v_ref text;
begin
  if not public.has_permission('payments.void') then
    raise exception 'insufficient_privilege: solo Administración o Finanzas pueden aprobar correcciones';
  end if;
  select * into v_req from public.payment_correction_requests where id = p_request_id for update;
  if not found or v_req.company_id not in (select public.user_company_ids()) then
    raise exception 'not_found: la solicitud no existe';
  end if;
  if v_req.status <> 'PENDING' then
    raise exception 'not_pending: esta solicitud ya fue decidida o retirada';
  end if;
  if v_req.requested_by = v_user then
    raise exception 'same_user: no puedes aprobar una corrección que pediste tú: debe aprobarla otra persona de Administración o Finanzas';
  end if;

  v_new := v_req.new_values;
  v_reason := 'Corrección aprobada: ' || v_req.reason;
  v_money := v_new ? 'amount' or v_new ? 'bank_account_id';

  if v_req.target_type = 'customer_payment' then
    select * into v_cp from public.customer_payments where id = v_req.target_id for update;
    if v_cp.status <> 'ACTIVE' then
      raise exception 'already_voided: el cobro ya está anulado';
    end if;
    if v_req.action = 'VOID' then
      perform public.mf_void_customer_payment(v_cp.id, v_reason);
      v_result := jsonb_build_object('voided', v_cp.id);
    elsif v_money then
      select category_id into v_category from public.bank_transactions
       where customer_payment_id = v_cp.id and reverses_transaction_id is null limit 1;
      perform public.mf_void_customer_payment(v_cp.id, v_reason);
      v_new_id := public.register_customer_payment(
        v_cp.company_id, v_cp.client_id, v_cp.invoice_id, v_cp.project_id,
        coalesce((v_new ->> 'bank_account_id')::uuid, v_cp.bank_account_id),
        coalesce((v_new ->> 'date')::date, v_cp.payment_date),
        coalesce((v_new ->> 'amount')::numeric, v_cp.amount),
        v_cp.method,
        case when v_new ? 'reference' then v_new ->> 'reference' else v_cp.reference end,
        v_cp.currency, v_cp.exchange_rate, v_cp.notes, v_category
      );
      update public.customer_payments set replaces_payment_id = v_cp.id where id = v_new_id;
      v_result := jsonb_build_object('voided', v_cp.id, 'new_id', v_new_id);
    else
      v_date := coalesce((v_new ->> 'date')::date, v_cp.payment_date);
      v_ref := case when v_new ? 'reference' then v_new ->> 'reference' else v_cp.reference end;
      for v_tx in select * from public.mf_payment_bank_rows('customer_payment', v_cp.id) loop
        if v_tx.reconciled then
          raise exception 'reconciled_locked: Este movimiento está conciliado: quítale la marca de conciliado en Bancos antes de corregirlo.';
        end if;
      end loop;
      update public.customer_payments set payment_date = v_date, reference = v_ref where id = v_cp.id;
      update public.bank_transactions set transaction_date = v_date,
             reference = case when customer_payment_id is not null then v_ref else reference end
       where id in (select id from public.mf_payment_bank_rows('customer_payment', v_cp.id));
      v_result := jsonb_build_object('updated', v_cp.id);
    end if;

  elsif v_req.target_type = 'supplier_payment' then
    select * into v_sp from public.supplier_payments where id = v_req.target_id for update;
    if v_sp.status <> 'ACTIVE' then
      raise exception 'already_voided: el pago ya está anulado';
    end if;
    if v_req.action = 'VOID' then
      perform public.mf_void_supplier_payment(v_sp.id, v_reason);
      v_result := jsonb_build_object('voided', v_sp.id);
    elsif v_money then
      perform public.mf_void_supplier_payment(v_sp.id, v_reason);
      v_new_id := public.register_supplier_payment(
        v_sp.company_id, v_sp.supplier_id, v_sp.expense_id, v_sp.project_id,
        coalesce((v_new ->> 'bank_account_id')::uuid, v_sp.bank_account_id),
        coalesce((v_new ->> 'date')::date, v_sp.payment_date),
        coalesce((v_new ->> 'amount')::numeric, v_sp.amount),
        v_sp.method,
        case when v_new ? 'reference' then v_new ->> 'reference' else v_sp.reference end,
        v_sp.currency, v_sp.exchange_rate, v_sp.notes, v_sp.payee_bank_name, true
      );
      update public.supplier_payments set replaces_payment_id = v_sp.id where id = v_new_id;
      v_result := jsonb_build_object('voided', v_sp.id, 'new_id', v_new_id);
    else
      v_date := coalesce((v_new ->> 'date')::date, v_sp.payment_date);
      v_ref := case when v_new ? 'reference' then v_new ->> 'reference' else v_sp.reference end;
      for v_tx in select * from public.mf_payment_bank_rows('supplier_payment', v_sp.id) loop
        if v_tx.reconciled then
          raise exception 'reconciled_locked: Este movimiento está conciliado: quítale la marca de conciliado en Bancos antes de corregirlo.';
        end if;
      end loop;
      update public.supplier_payments set payment_date = v_date, reference = v_ref where id = v_sp.id;
      update public.bank_transactions set transaction_date = v_date,
             reference = case when supplier_payment_id is not null then v_ref else reference end
       where id in (select id from public.mf_payment_bank_rows('supplier_payment', v_sp.id));
      v_result := jsonb_build_object('updated', v_sp.id);
    end if;

  else
    select * into v_tx from public.bank_transactions where id = v_req.target_id for update;
    if v_tx.voided_at is not null then
      raise exception 'already_voided: el movimiento ya está anulado';
    end if;
    if v_tx.reconciled then
      raise exception 'reconciled_locked: Este movimiento está conciliado: quítale la marca de conciliado en Bancos antes de corregirlo.';
    end if;
    if v_req.action = 'VOID' then
      perform public.mf_reverse_bank_transaction(v_tx.id, v_reason);
      v_result := jsonb_build_object('voided', v_tx.id);
    elsif v_money then
      perform public.mf_reverse_bank_transaction(v_tx.id, v_reason);
      insert into public.bank_transactions (
        company_id, bank_account_id, project_id, client_id, supplier_id,
        type, amount, currency, exchange_rate, transaction_date, description, category_id, reference, overdraft_confirmed
      ) values (
        v_tx.company_id, coalesce((v_new ->> 'bank_account_id')::uuid, v_tx.bank_account_id), v_tx.project_id, v_tx.client_id, v_tx.supplier_id,
        v_tx.type, coalesce((v_new ->> 'amount')::numeric, v_tx.amount), v_tx.currency, v_tx.exchange_rate,
        coalesce((v_new ->> 'date')::date, v_tx.transaction_date),
        coalesce(v_new ->> 'description', v_tx.description), v_tx.category_id,
        case when v_new ? 'reference' then v_new ->> 'reference' else v_tx.reference end, true
      )
      returning id into v_new_id;
      v_result := jsonb_build_object('voided', v_tx.id, 'new_id', v_new_id);
    else
      update public.bank_transactions
         set transaction_date = coalesce((v_new ->> 'date')::date, transaction_date),
             reference = case when v_new ? 'reference' then v_new ->> 'reference' else reference end,
             description = coalesce(v_new ->> 'description', description)
       where id = v_tx.id;
      v_result := jsonb_build_object('updated', v_tx.id);
    end if;
  end if;

  update public.payment_correction_requests
     set status = 'APPROVED', decided_by = v_user, decided_at = now(),
         decision_note = nullif(trim(coalesce(p_note, '')), ''), result = v_result
   where id = v_req.id;

  insert into public.audit_logs (company_id, user_id, action, entity_type, entity_id, old_values, new_values)
  values (v_req.company_id, v_user, 'CORRECTION_APPROVE', v_req.target_type, v_req.target_id, v_req.old_values,
    jsonb_build_object('request_id', v_req.id, 'action', v_req.action, 'changes', v_new,
      'reason', v_req.reason, 'requested_by', v_req.requested_by, 'note', p_note, 'result', v_result));

  insert into public.notifications (company_id, user_id, type, title, message, entity_type, entity_id)
  values (v_req.company_id, v_req.requested_by, 'correction_decided', 'Corrección aprobada',
    v_req.target_label || ' · ya se aplicó', 'payment_correction', v_req.id);

  return v_result;
end;
$$;

create or replace function public.reject_payment_correction(p_request_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_req record;
begin
  if not public.has_permission('payments.void') then
    raise exception 'insufficient_privilege: solo Administración o Finanzas pueden rechazar correcciones';
  end if;
  if length(trim(coalesce(p_note, ''))) < 5 then
    raise exception 'reason_required: escribe por qué la rechazas, para que quien la pidió entienda';
  end if;
  select * into v_req from public.payment_correction_requests where id = p_request_id for update;
  if not found or v_req.company_id not in (select public.user_company_ids()) then
    raise exception 'not_found: la solicitud no existe';
  end if;
  if v_req.status <> 'PENDING' then
    raise exception 'not_pending: esta solicitud ya fue decidida o retirada';
  end if;
  if v_req.requested_by = v_user then
    raise exception 'same_user: es tu propia solicitud: si ya no la necesitas, usa «Retirar»';
  end if;
  update public.payment_correction_requests
     set status = 'REJECTED', decided_by = v_user, decided_at = now(), decision_note = trim(p_note)
   where id = v_req.id;
  insert into public.audit_logs (company_id, user_id, action, entity_type, entity_id, new_values)
  values (v_req.company_id, v_user, 'CORRECTION_REJECT', v_req.target_type, v_req.target_id,
    jsonb_build_object('request_id', v_req.id, 'action', v_req.action, 'note', trim(p_note), 'requested_by', v_req.requested_by));
  insert into public.notifications (company_id, user_id, type, title, message, entity_type, entity_id)
  values (v_req.company_id, v_req.requested_by, 'correction_decided', 'Corrección rechazada',
    v_req.target_label || ' · ' || trim(p_note), 'payment_correction', v_req.id);
end;
$$;

create or replace function public.withdraw_payment_correction(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_req record;
begin
  select * into v_req from public.payment_correction_requests where id = p_request_id for update;
  if not found or v_req.company_id not in (select public.user_company_ids()) then
    raise exception 'not_found: la solicitud no existe';
  end if;
  if v_req.requested_by <> v_user then
    raise exception 'not_owner: solo quien pidió la corrección puede retirarla';
  end if;
  if v_req.status <> 'PENDING' then
    raise exception 'not_pending: esta solicitud ya fue decidida o retirada';
  end if;
  update public.payment_correction_requests
     set status = 'WITHDRAWN', decided_by = v_user, decided_at = now()
   where id = v_req.id;
  insert into public.audit_logs (company_id, user_id, action, entity_type, entity_id, new_values)
  values (v_req.company_id, v_user, 'CORRECTION_WITHDRAW', v_req.target_type, v_req.target_id,
    jsonb_build_object('request_id', v_req.id));
end;
$$;

revoke execute on function public.request_payment_correction(text, uuid, text, jsonb, text) from public, anon;
revoke execute on function public.approve_payment_correction(uuid, text) from public, anon;
revoke execute on function public.reject_payment_correction(uuid, text) from public, anon;
revoke execute on function public.withdraw_payment_correction(uuid) from public, anon;
grant execute on function public.request_payment_correction(text, uuid, text, jsonb, text) to authenticated;
grant execute on function public.approve_payment_correction(uuid, text) to authenticated;
grant execute on function public.reject_payment_correction(uuid, text) to authenticated;
grant execute on function public.withdraw_payment_correction(uuid) to authenticated;
