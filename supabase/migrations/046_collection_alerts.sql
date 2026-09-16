-- Fase 4 del módulo financiero avanzado: responsable de cobro, historial
-- de gestión, y alertas de vencimiento automáticas (de verdad automáticas
-- — vía pg_cron, no solo calculadas al abrir una pantalla).

-- 1) Responsable de cobro por factura.
alter table public.invoices
  add column if not exists responsible_user_id uuid references public.profiles (id) on delete set null;

create index if not exists idx_invoices_responsible on public.invoices (responsible_user_id);

-- 2) Historial de gestión de cobro — trazabilidad de cada intento de
--    cobro sobre una factura (llamada, email, WhatsApp, nota, etc.).
create table if not exists public.invoice_collection_history (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  action_date date not null default current_date,
  action text not null check (action in ('CALL', 'EMAIL', 'WHATSAPP', 'VISIT', 'NOTE', 'OTHER')),
  comment text,
  result text,
  next_action_date date,
  created_at timestamptz not null default now()
);

create index if not exists idx_collection_history_invoice on public.invoice_collection_history (invoice_id);

alter table public.invoice_collection_history enable row level security;

create policy collection_history_select on public.invoice_collection_history for select
  using (company_id in (select public.user_company_ids()));

create policy collection_history_insert on public.invoice_collection_history for insert
  with check (
    company_id in (select public.user_company_ids())
    and public.has_permission('invoices.view')
  );

-- El historial de gestión es un registro de auditoría de cobros — no se
-- edita ni se borra, igual que audit_logs (si algo estuvo mal, se agrega
-- una entrada nueva aclarando, no se reescribe el pasado).

-- 3) Motor de alertas de vencimiento. Genera una notificación interna
--    (tabla notifications ya existente) para el RESPONSABLE de cada
--    factura pendiente, cuando su vencimiento cae exactamente en: vencida
--    (cualquier día después), hoy, o faltan 1/3/7 días — tal como se
--    pidió. Sin responsable asignado, no hay a quién avisar, se omite.
--    Con protección para no duplicar la misma alerta el mismo día (por si
--    se llama más de una vez, ej. al abrir el Dashboard además del cron).
create or replace function public.generate_due_date_alerts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice record;
  v_days_until int;
  v_alert_type text;
  v_title text;
  v_message text;
  v_created int := 0;
begin
  for v_invoice in
    select i.id, i.number, i.due_date, i.balance, i.currency, i.responsible_user_id, i.company_id,
           c.name as client_name
    from public.invoices i
    join public.clients c on c.id = i.client_id
    where i.status in ('ISSUED', 'PARTIALLY_PAID', 'OVERDUE')
      and i.balance > 0
      and i.due_date is not null
      and i.responsible_user_id is not null
  loop
    v_days_until := v_invoice.due_date - current_date;

    v_alert_type := case
      when v_days_until < 0 then 'invoice_overdue'
      when v_days_until = 0 then 'invoice_due_today'
      when v_days_until = 1 then 'invoice_due_1d'
      when v_days_until = 3 then 'invoice_due_3d'
      when v_days_until = 7 then 'invoice_due_7d'
      else null
    end;

    if v_alert_type is null then
      continue;
    end if;

    -- Ya se generó esta misma alerta hoy para esta factura: no duplicar.
    if exists (
      select 1 from public.notifications n
      where n.entity_type = 'invoice'
        and n.entity_id = v_invoice.id
        and n.type = v_alert_type
        and n.created_at::date = current_date
    ) then
      continue;
    end if;

    v_title := case
      when v_alert_type = 'invoice_overdue' then 'Factura vencida: ' || v_invoice.number
      when v_alert_type = 'invoice_due_today' then 'Vence hoy: ' || v_invoice.number
      else 'Vence en ' || v_days_until || ' días: ' || v_invoice.number
    end;
    v_message := v_invoice.client_name || ' — ' ||
      to_char(v_invoice.balance, 'FM999,999,990.00') || ' ' || v_invoice.currency;

    insert into public.notifications (company_id, user_id, type, title, message, entity_type, entity_id)
    values (v_invoice.company_id, v_invoice.responsible_user_id, v_alert_type, v_title, v_message, 'invoice', v_invoice.id);

    v_created := v_created + 1;
  end loop;

  return v_created;
end;
$$;

revoke execute on function public.generate_due_date_alerts() from public, anon, authenticated;

-- 4) Programar la ejecución diaria de verdad (no solo "al abrir una
--    pantalla") — una vez al día a las 8:00am UTC. Se desprograma primero
--    por si ya existía (para que esta migración sea segura de re-aplicar).
create extension if not exists pg_cron with schema extensions;

do $$
begin
  perform cron.unschedule('generate-due-date-alerts-daily');
exception when others then
  null;
end $$;

select cron.schedule(
  'generate-due-date-alerts-daily',
  '0 8 * * *',
  $cron$select public.generate_due_date_alerts();$cron$
);
