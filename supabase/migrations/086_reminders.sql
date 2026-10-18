-- 086 — Motor de recordatorios (prueba BE), acordado el 30-sep y el 18-oct.
--
-- Recordatorios automáticos por correo a CLIENTES:
--   * Facturas abiertas: según días respecto al vencimiento (por defecto
--     3 antes, el día y 10 después; se cambian en Configuración).
--   * Encuesta de satisfacción sin responder: cada X días, máximo N veces
--     (ajustes que ya existían en survey_settings).
-- Más la lista diaria "para recordar por WhatsApp" (la persona lo envía
-- desde su WhatsApp con el chat ya escrito).
--
-- Decisiones del usuario (18-oct): al correo que tiene registrado el
-- cliente; solo facturas ya emitidas y, si la factura es de un proyecto,
-- solo cuando el proyecto está Completado; sin copia por correo (queda
-- registro en Gestión de cobro y en la campana del responsable). El
-- interruptor general arranca apagado mientras se trabaja con datos de prueba.
--
-- Seguridad: el correo lo envía la app (SMTP del servidor). La tarea diaria
-- (pg_cron + pg_net) llama a la app con una clave guardada SOLO en Supabase
-- Vault; la app no guarda esa clave ni usa la secret key: cada función de
-- aquí comprueba la clave (tarea diaria) o el permiso del usuario
-- (botón "Revisar ahora"). Nada de esto toca montos, impuestos,
-- retenciones ni fiscal_snapshot.

-- ---------------------------------------------------------------- tablas

create table if not exists public.reminder_settings (
  company_id uuid primary key references public.companies (id) on delete cascade,
  -- Interruptor general de envíos automáticos por correo (facturas y encuestas).
  auto_send_enabled boolean not null default false,
  -- Días respecto al vencimiento: negativo = antes, 0 = el día, positivo = después.
  invoice_days integer[] not null default '{-3,0,10}',
  invoice_subject text not null default 'Recordatorio: factura {factura} de {empresa}',
  invoice_message text not null default
    'Te recordamos que la factura {factura} por {monto} {cuando}. Si ya realizaste el pago, por favor ignora este mensaje o envíanos el comprobante. ¡Gracias!',
  whatsapp_message text not null default
    'Hola {contacto}, te saluda {empresa}. Te recordamos que la factura {factura} por {monto} {cuando}. Si ya pagaste, por favor ignora este mensaje. ¡Gracias!',
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  constraint reminder_days_range check (
    cardinality(invoice_days) between 1 and 10
    and -60 <= all(invoice_days) and 120 >= all(invoice_days)
  )
);

create table if not exists public.reminder_log (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  -- INVOICE = correo de factura, INVOICE_WA = WhatsApp de factura, SURVEY = correo de encuesta.
  kind text not null check (kind in ('INVOICE', 'INVOICE_WA', 'SURVEY')),
  entity_id uuid not null,
  -- Factura: días respecto al vencimiento. Encuesta: número de recordatorio (1, 2…).
  step integer not null,
  channel text not null check (channel in ('EMAIL', 'WHATSAPP')),
  recipient text,
  status text not null default 'PENDING' check (status in ('PENDING', 'SENT', 'FAILED')),
  error text,
  -- Quién lo disparó: tarea diaria (CRON), botón "Revisar ahora" (MANUAL) o WhatsApp (persona).
  source text not null default 'CRON' check (source in ('CRON', 'MANUAL', 'USER')),
  user_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

-- Un mismo recordatorio (documento + paso + canal) no se manda dos veces.
-- Uno FALLIDO no bloquea: se puede reintentar otro día.
create unique index if not exists reminder_log_once
  on public.reminder_log (kind, entity_id, step)
  where status in ('PENDING', 'SENT');
create index if not exists reminder_log_company_created on public.reminder_log (company_id, created_at desc);

alter table public.reminder_settings enable row level security;
alter table public.reminder_log enable row level security;

drop policy if exists reminder_settings_select on public.reminder_settings;
create policy reminder_settings_select on public.reminder_settings
  for select to authenticated
  using (
    company_id in (select public.user_company_ids())
    and (public.has_permission('settings.manage') or public.has_permission('invoices.view'))
  );

drop policy if exists reminder_settings_write on public.reminder_settings;
create policy reminder_settings_write on public.reminder_settings
  for all to authenticated
  using (company_id in (select public.user_company_ids()) and public.has_permission('settings.manage'))
  with check (company_id in (select public.user_company_ids()) and public.has_permission('settings.manage'));

-- El registro solo se lee; lo escriben las funciones de abajo.
drop policy if exists reminder_log_select on public.reminder_log;
create policy reminder_log_select on public.reminder_log
  for select to authenticated
  using (
    company_id in (select public.user_company_ids())
    and (public.has_permission('settings.manage') or public.has_permission('invoices.view'))
  );

-- Fila de ajustes para cada empresa existente (apagada).
insert into public.reminder_settings (company_id)
select id from public.companies
on conflict (company_id) do nothing;

-- ---------------------------------------------------------------- acceso

-- ¿Quién llama? Devuelve las empresas que puede procesar:
--  * con la clave de la tarea diaria (Vault 'reminders_cron_secret'): todas;
--  * con sesión y permiso settings.manage: las suyas;
--  * otro caso: error.
create or replace function public.reminders_allowed_companies(p_secret text)
returns setof uuid
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_secret text;
begin
  if p_secret is not null and length(p_secret) >= 32 then
    select decrypted_secret into v_secret
      from vault.decrypted_secrets
     where name = 'reminders_cron_secret'
     limit 1;
    if v_secret is not null and v_secret = p_secret then
      return query select id from public.companies where is_active;
      return;
    end if;
    raise exception 'reminders_forbidden: clave no válida' using errcode = '42501';
  end if;
  if auth.uid() is not null and public.has_permission('settings.manage') then
    return query select public.user_company_ids();
    return;
  end if;
  raise exception 'reminders_forbidden: sin permiso' using errcode = '42501';
end;
$function$;

-- Datos para decidir qué recordar hoy (la decisión la toma la app, con
-- funciones probadas: features/reminders/schedule.ts).
create or replace function public.reminders_candidates(p_secret text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_companies uuid[];
begin
  select array_agg(c) into v_companies from public.reminders_allowed_companies(p_secret) c;
  if v_companies is null then
    return jsonb_build_object('companies', '[]'::jsonb, 'invoices', '[]'::jsonb, 'surveys', '[]'::jsonb);
  end if;

  return jsonb_build_object(
    'companies', coalesce((
      select jsonb_agg(jsonb_build_object(
        'company_id', co.id,
        'name', co.name,
        'logo_url', co.logo_url,
        'brand_primary', co.brand_primary,
        'brand_accent', co.brand_accent,
        'auto_send_enabled', coalesce(rs.auto_send_enabled, false),
        'invoice_days', coalesce(rs.invoice_days, '{-3,0,10}'),
        'invoice_subject', rs.invoice_subject,
        'invoice_message', rs.invoice_message,
        'whatsapp_message', rs.whatsapp_message,
        'survey_reminder_enabled', coalesce(ss.reminder_enabled, false),
        'survey_after_days', coalesce(ss.reminder_after_days, 3),
        'survey_max', coalesce(ss.max_reminders, 1),
        'survey_subject', ss.email_subject,
        'survey_message', ss.email_message
      ))
      from public.companies co
      left join public.reminder_settings rs on rs.company_id = co.id
      left join public.survey_settings ss on ss.company_id = co.id
      where co.id = any(v_companies)
    ), '[]'::jsonb),
    'invoices', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id,
        'company_id', i.company_id,
        'number', i.number,
        'status', i.status,
        'due_date', i.due_date,
        'total', i.total,
        'balance', i.balance,
        'currency', i.currency,
        'bank_details', i.bank_details,
        'responsible_user_id', coalesce(i.responsible_user_id, i.created_by),
        'client_name', cl.name,
        'client_email', cl.email,
        'client_phone', cl.phone,
        'contact_name', ct.full_name,
        'contact_email', ct.email,
        'contact_phone', ct.phone,
        'sent_steps', coalesce((
          select jsonb_agg(jsonb_build_object('kind', l.kind, 'step', l.step))
          from public.reminder_log l
          where l.entity_id = i.id and l.status in ('PENDING', 'SENT')
        ), '[]'::jsonb)
      ))
      from public.invoices i
      join public.clients cl on cl.id = i.client_id
      left join lateral (
        select c.full_name, c.email, c.phone
          from public.client_contacts c
         where c.client_id = i.client_id
         order by c.is_primary desc, c.created_at
         limit 1
      ) ct on true
      where i.company_id = any(v_companies)
        and i.status in ('ISSUED', 'PARTIALLY_PAID', 'OVERDUE')
        and i.balance > 0
        and i.due_date is not null
        and i.due_date between current_date - 130 and current_date + 70
        -- Factura de un proyecto: solo cuando el proyecto está Completado.
        and (
          i.project_id is null
          or exists (select 1 from public.projects pj where pj.id = i.project_id and pj.status = 'COMPLETED')
        )
    ), '[]'::jsonb),
    'surveys', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'company_id', s.company_id,
        'token', s.token,
        'recipient_name', s.recipient_name,
        'recipient_email', s.recipient_email,
        'reminder_count', s.reminder_count,
        'last_contact_at', greatest(s.sent_at, s.last_sent_at, s.last_reminder_at),
        'project_name', p.name,
        'event_date', p.event_date,
        'client_name', cl.name,
        'created_by', coalesce(s.sent_by, s.created_by)
      ))
      from public.project_surveys s
      join public.projects p on p.id = s.project_id
      join public.clients cl on cl.id = s.client_id
      where s.company_id = any(v_companies)
        and s.status = 'SENT'
        and s.recipient_email is not null
    ), '[]'::jsonb)
  );
end;
$function$;

-- Aparta los recordatorios que se van a enviar (evita duplicados si dos
-- revisiones corren a la vez). Devuelve los que quedaron apartados.
-- p_jobs: [{kind, entity_id, company_id, step, channel, recipient}]
create or replace function public.reminders_claim(p_secret text, p_jobs jsonb, p_source text default 'CRON')
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public'
as $function$
declare
  v_companies uuid[];
  v_job jsonb;
  v_id uuid;
  v_out jsonb := '[]'::jsonb;
begin
  select array_agg(c) into v_companies from public.reminders_allowed_companies(p_secret) c;
  for v_job in select * from jsonb_array_elements(coalesce(p_jobs, '[]'::jsonb)) loop
    if not ((v_job->>'company_id')::uuid = any(coalesce(v_companies, '{}'))) then
      continue;
    end if;
    insert into public.reminder_log (company_id, kind, entity_id, step, channel, recipient, status, source, user_id)
    values (
      (v_job->>'company_id')::uuid,
      v_job->>'kind',
      (v_job->>'entity_id')::uuid,
      (v_job->>'step')::int,
      v_job->>'channel',
      left(v_job->>'recipient', 200),
      'PENDING',
      case when p_source in ('CRON', 'MANUAL') then p_source else 'CRON' end,
      auth.uid()
    )
    on conflict do nothing
    returning id into v_id;
    if v_id is not null then
      v_out := v_out || jsonb_build_object('log_id', v_id, 'kind', v_job->>'kind', 'entity_id', v_job->>'entity_id', 'step', (v_job->>'step')::int);
    end if;
    v_id := null;
  end loop;
  return v_out;
end;
$function$;

-- Resultado de cada envío: SENT o FAILED. Si se envió:
--  * factura → anota en Gestión de cobro + campana del responsable;
--  * encuesta → suma el recordatorio en la encuesta.
-- p_results: [{log_id, ok, error, comment}]
create or replace function public.reminders_finish(p_secret text, p_results jsonb)
returns integer
language plpgsql
volatile
security definer
set search_path to 'public'
as $function$
declare
  v_companies uuid[];
  v_res jsonb;
  v_log public.reminder_log%rowtype;
  v_inv record;
  v_user uuid;
  v_n int := 0;
begin
  select array_agg(c) into v_companies from public.reminders_allowed_companies(p_secret) c;
  for v_res in select * from jsonb_array_elements(coalesce(p_results, '[]'::jsonb)) loop
    select * into v_log from public.reminder_log
     where id = (v_res->>'log_id')::uuid and status = 'PENDING' and company_id = any(coalesce(v_companies, '{}'));
    if not found then
      continue;
    end if;

    if coalesce((v_res->>'ok')::boolean, false) then
      update public.reminder_log set status = 'SENT', sent_at = now(), error = null where id = v_log.id;
      v_n := v_n + 1;

      if v_log.kind = 'INVOICE' then
        select id, company_id, number, coalesce(responsible_user_id, created_by) as who
          into v_inv from public.invoices where id = v_log.entity_id;
        v_user := coalesce(auth.uid(), v_inv.who);
        if v_inv.id is not null and v_user is not null then
          insert into public.invoice_collection_history (company_id, invoice_id, user_id, action_date, action, comment, result)
          values (v_inv.company_id, v_inv.id, v_user, current_date, 'EMAIL',
                  left(coalesce(v_res->>'comment', 'Recordatorio automático por correo'), 500)
                    || ' → ' || coalesce(v_log.recipient, ''),
                  'Enviado por el sistema');
        end if;
        if v_inv.who is not null then
          insert into public.notifications (company_id, user_id, type, title, message, entity_type, entity_id)
          values (v_inv.company_id, v_inv.who, 'REMINDER_SENT',
                  'Recordatorio enviado · ' || v_inv.number,
                  left(coalesce(v_res->>'comment', 'Se envió el recordatorio al cliente.'), 300),
                  'invoice', v_inv.id);
        end if;
      elsif v_log.kind = 'SURVEY' then
        update public.project_surveys
           set reminder_count = reminder_count + 1, last_reminder_at = now()
         where id = v_log.entity_id;
      end if;
    else
      update public.reminder_log
         set status = 'FAILED', error = left(coalesce(v_res->>'error', 'No se pudo enviar'), 300)
       where id = v_log.id;
    end if;
  end loop;
  return v_n;
end;
$function$;

-- WhatsApp: la persona abre el chat ya escrito desde la lista "Para recordar
-- hoy"; esto lo deja registrado (lista, Gestión de cobro).
create or replace function public.reminder_mark_whatsapp(p_invoice_id uuid, p_step integer, p_phone text)
returns void
language plpgsql
volatile
security definer
set search_path to 'public'
as $function$
declare
  v_inv record;
begin
  select id, company_id, number into v_inv from public.invoices
   where id = p_invoice_id and company_id in (select public.user_company_ids());
  if v_inv.id is null or not public.has_permission('invoices.view') then
    raise exception 'reminders_forbidden: sin permiso' using errcode = '42501';
  end if;
  insert into public.reminder_log (company_id, kind, entity_id, step, channel, recipient, status, source, user_id, sent_at)
  values (v_inv.company_id, 'INVOICE_WA', v_inv.id, p_step, 'WHATSAPP', left(p_phone, 40), 'SENT', 'USER', auth.uid(), now())
  on conflict do nothing;
  insert into public.invoice_collection_history (company_id, invoice_id, user_id, action_date, action, comment, result)
  values (v_inv.company_id, v_inv.id, auth.uid(), current_date, 'WHATSAPP',
          'Recordatorio por WhatsApp (lista «Para recordar hoy»)' || coalesce(' → ' || nullif(p_phone, ''), ''),
          'Mensaje abierto en WhatsApp');
end;
$function$;

revoke all on function public.reminders_allowed_companies(text) from public, anon, authenticated;
revoke all on function public.reminders_candidates(text) from public;
revoke all on function public.reminders_claim(text, jsonb, text) from public;
revoke all on function public.reminders_finish(text, jsonb) from public;
revoke all on function public.reminder_mark_whatsapp(uuid, integer, text) from public, anon;
-- La tarea diaria llega a la app sin sesión (rol anon) y pasa la clave; la
-- función la valida contra Vault. Con sesión, se valida el permiso.
grant execute on function public.reminders_candidates(text) to anon, authenticated;
grant execute on function public.reminders_claim(text, jsonb, text) to anon, authenticated;
grant execute on function public.reminders_finish(text, jsonb) to anon, authenticated;
grant execute on function public.reminder_mark_whatsapp(uuid, integer, text) to authenticated;

-- ---------------------------------------------------------------- tarea diaria

create extension if not exists pg_net with schema extensions;

do $$
begin
  perform cron.unschedule('send-reminders-daily');
exception when others then
  null;
end $$;

-- 8:15 a. m. hora de RD (12:15 UTC). Solo llama si en Vault están
-- 'reminders_url' (https://<dominio>/api/cron/reminders) y
-- 'reminders_cron_secret' (clave larga al azar). Ver MANUAL_NOTES.md.
select cron.schedule(
  'send-reminders-daily',
  '15 12 * * *',
  $cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'reminders_url' limit 1),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-reminders-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'reminders_cron_secret' limit 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  )
  where exists (select 1 from vault.decrypted_secrets where name = 'reminders_url')
    and exists (select 1 from vault.decrypted_secrets where name = 'reminders_cron_secret');
  $cron$
);
