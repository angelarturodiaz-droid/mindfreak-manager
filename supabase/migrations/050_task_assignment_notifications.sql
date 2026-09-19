-- Tareas: alertar al usuario asignado cuando se le coloca una tarea (al
-- crearla o al reasignarla). Reutiliza la tabla notifications y el
-- NotificationBell ya existentes (mismo patrón que generate_due_date_alerts
-- en 046_collection_alerts.sql) — no se crea infraestructura nueva.
--
-- No se notifica si la tarea queda sin asignar (assigned_to null) ni si el
-- usuario se la asigna a sí mismo (no tiene sentido alertarlo de algo que
-- él mismo acaba de hacer).

create or replace function public.notify_task_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.assigned_to is not null
     and (tg_op = 'INSERT' or old.assigned_to is distinct from new.assigned_to)
     and new.assigned_to <> coalesce(new.created_by, '00000000-0000-0000-0000-000000000000'::uuid)
  then
    insert into public.notifications (company_id, user_id, type, title, message, entity_type, entity_id)
    values (
      new.company_id,
      new.assigned_to,
      'task_assigned',
      'Nueva tarea asignada: ' || new.title,
      case when new.due_date is not null
        then 'Vence: ' || to_char(new.due_date, 'DD/MM/YYYY')
        else null
      end,
      'task',
      new.id
    );
  end if;

  return new;
end;
$$;

revoke execute on function public.notify_task_assignment() from public, anon, authenticated;

drop trigger if exists trg_notify_task_assignment on public.tasks;

create trigger trg_notify_task_assignment
  after insert or update of assigned_to on public.tasks
  for each row
  execute function public.notify_task_assignment();
