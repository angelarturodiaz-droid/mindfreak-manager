-- 092 — Proyecto pasa solo a «En curso» el día del evento (29-oct-2026).
--
-- Cada día (tarea generate-due-date-alerts-daily, 4:00 a. m. en RD) los
-- proyectos en CONFIRMADO cuya fecha del evento ya llegó pasan a EN CURSO.
-- Avisa al responsable (campanita) y queda en Auditoría como automático.
-- Proyectos sin fecha: no se mueven (la pantalla lo avisa y pregunta al emitir
-- una factura). Solo agrega. Idempotente.

create or replace function public.start_projects_on_event_date()
returns integer
language plpgsql
security definer
set search_path = public
set timezone = 'America/Santo_Domingo'
as $function$
declare
  v_p record;
  v_count int := 0;
begin
  for v_p in
    select id, company_id, number, name, manager_id, event_date
      from public.projects
     where status = 'CONFIRMED'
       and event_date is not null
       and event_date <= current_date
     for update
  loop
    update public.projects set status = 'IN_PROGRESS' where id = v_p.id;

    insert into public.audit_logs (company_id, user_id, action, entity_type, entity_id, old_values, new_values)
    values (v_p.company_id, null, 'STATUS_IN_PROGRESS', 'project', v_p.id,
      jsonb_build_object('status', 'CONFIRMED'),
      jsonb_build_object('status', 'IN_PROGRESS', 'automatico', true,
        'motivo', 'Llegó la fecha del evento (' || to_char(v_p.event_date, 'DD-MM-YYYY') || ')'));

    if v_p.manager_id is not null then
      insert into public.notifications (company_id, user_id, type, title, message, entity_type, entity_id)
      values (v_p.company_id, v_p.manager_id, 'project_started',
        v_p.number || ' pasó a En curso',
        'Hoy es el evento «' || v_p.name || '». El sistema lo marcó En curso automáticamente.',
        'project', v_p.id);
    end if;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$function$;

revoke all on function public.start_projects_on_event_date() from public, anon, authenticated;

-- La tarea diaria existente también corre este paso.
do $do$
begin
  if exists (select 1 from cron.job where jobname = 'generate-due-date-alerts-daily') then
    perform cron.alter_job(
      (select jobid from cron.job where jobname = 'generate-due-date-alerts-daily'),
      command := 'select public.generate_due_date_alerts(); select public.start_projects_on_event_date();'
    );
  end if;
end
$do$;
