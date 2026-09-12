-- F18: faltaba política de DELETE en tasks (select/insert/update ya existían
-- desde F4). Una tarea no es un registro financiero, así que sí se puede
-- borrar físicamente (a diferencia de invoices/expenses/etc., F0 sección M).
-- `activities` se deja sin update/delete a propósito — es una bitácora de
-- actividades (llamadas, reuniones, notas), conceptualmente similar a
-- audit_logs: se registra pero no se edita ni se borra después.

create policy tasks_delete on public.tasks for delete
  using (
    company_id in (select public.user_company_ids())
    and public.has_permission('projects.update')
  );
