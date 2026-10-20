-- 087 — Recordatorios por tipo (19-oct): cada tipo tiene su propio encendido,
-- además del interruptor general. Facturas por cobrar = invoice_enabled
-- (la encuesta ya tenía survey_settings.reminder_enabled). Solo agrega una
-- columna y devuelve el dato en reminders_candidates; no toca datos.
-- (El respaldo A0 pasa a la 088 y la limpieza Go-Live A1 a la 089.)

alter table public.reminder_settings
  add column if not exists invoice_enabled boolean not null default true;

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
        'invoice_enabled', coalesce(rs.invoice_enabled, true),
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
        -- Contactos marcados «Recibe recordatorios de cobro».
        'billing', coalesce((
          select jsonb_agg(jsonb_build_object('name', bc.full_name, 'email', bc.email, 'phone', bc.phone)
                           order by bc.is_primary desc, bc.created_at)
          from public.client_contacts bc
          where bc.client_id = i.client_id and bc.receives_billing
        ), '[]'::jsonb),
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
