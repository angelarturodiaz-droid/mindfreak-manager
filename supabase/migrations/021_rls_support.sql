-- F4: Políticas RLS — Documentos, Operaciones, Aprobaciones, Auditoría,
-- Notificaciones, Configuración, Importaciones

create policy documents_select on public.documents for select
  using (company_id in (select public.user_company_ids()) and public.has_permission('documents.view'));
create policy documents_insert on public.documents for insert
  with check (company_id in (select public.user_company_ids()) and public.has_permission('documents.upload'));

-- Tareas/Actividades: se gatean con projects.view/update (son sub-elementos
-- operativos de un proyecto; no tienen permiso propio en el catálogo actual).
create policy tasks_select on public.tasks for select
  using (company_id in (select public.user_company_ids()) and public.has_permission('projects.view'));
create policy tasks_insert on public.tasks for insert
  with check (company_id in (select public.user_company_ids()) and public.has_permission('projects.update'));
create policy tasks_update on public.tasks for update
  using (company_id in (select public.user_company_ids()) and public.has_permission('projects.update'))
  with check (company_id in (select public.user_company_ids()) and public.has_permission('projects.update'));

create policy activities_select on public.activities for select
  using (company_id in (select public.user_company_ids()) and public.has_permission('projects.view'));
create policy activities_insert on public.activities for insert
  with check (company_id in (select public.user_company_ids()) and public.has_permission('projects.update'));

-- Aprobaciones: visibles para quien solicitó o quien debe aprobar; o users.manage
create policy approvals_select on public.approvals for select
  using (
    company_id in (select public.user_company_ids())
    and (requested_by = auth.uid() or approver_id = auth.uid() or public.has_permission('users.manage'))
  );
create policy approvals_insert on public.approvals for insert
  with check (company_id in (select public.user_company_ids()));
create policy approvals_update on public.approvals for update
  using (company_id in (select public.user_company_ids()) and (approver_id = auth.uid() or public.has_permission('users.manage')))
  with check (company_id in (select public.user_company_ids()) and (approver_id = auth.uid() or public.has_permission('users.manage')));

-- Auditoría: inmutable. Cada quien solo registra sus propias acciones;
-- lectura reservada a quienes gestionan configuración (rol con visión global).
create policy audit_logs_select on public.audit_logs for select
  using (company_id in (select public.user_company_ids()) and public.has_permission('settings.manage'));
create policy audit_logs_insert on public.audit_logs for insert
  with check (company_id in (select public.user_company_ids()) and user_id = auth.uid());

-- Notificaciones: cada quien ve/marca como leídas solo las suyas;
-- cualquier usuario de la empresa puede generar una notificación para otro.
create policy notifications_select on public.notifications for select
  using (user_id = auth.uid());
create policy notifications_insert on public.notifications for insert
  with check (company_id in (select public.user_company_ids()));
create policy notifications_update on public.notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Configuración: lectura amplia (branding/nombre de plataforma los usa toda la UI)
create policy settings_select on public.settings for select
  using (company_id in (select public.user_company_ids()));
create policy settings_write on public.settings for all
  using (company_id in (select public.user_company_ids()) and public.has_permission('settings.manage'))
  with check (company_id in (select public.user_company_ids()) and public.has_permission('settings.manage'));

-- Importaciones masivas: por ahora solo clientes (clients.import)
create policy import_batches_select on public.import_batches for select
  using (company_id in (select public.user_company_ids()) and public.has_permission('clients.import'));
create policy import_batches_insert on public.import_batches for insert
  with check (company_id in (select public.user_company_ids()) and public.has_permission('clients.import'));
