-- F4: Políticas RLS — Clientes, Proveedores, Servicios

create policy clients_select on public.clients for select
  using (company_id in (select public.user_company_ids()) and public.has_permission('clients.view'));
create policy clients_insert on public.clients for insert
  with check (company_id in (select public.user_company_ids()) and public.has_permission('clients.create'));
create policy clients_update on public.clients for update
  using (company_id in (select public.user_company_ids()) and (public.has_permission('clients.update') or public.has_permission('clients.convert')))
  with check (company_id in (select public.user_company_ids()) and (public.has_permission('clients.update') or public.has_permission('clients.convert')));
create policy clients_delete on public.clients for delete
  using (company_id in (select public.user_company_ids()) and public.has_permission('clients.delete'));

create policy client_contacts_select on public.client_contacts for select
  using (company_id in (select public.user_company_ids()) and public.has_permission('clients.view'));
create policy client_contacts_insert on public.client_contacts for insert
  with check (company_id in (select public.user_company_ids()) and public.has_permission('clients.update'));
create policy client_contacts_update on public.client_contacts for update
  using (company_id in (select public.user_company_ids()) and public.has_permission('clients.update'))
  with check (company_id in (select public.user_company_ids()) and public.has_permission('clients.update'));
create policy client_contacts_delete on public.client_contacts for delete
  using (company_id in (select public.user_company_ids()) and public.has_permission('clients.delete'));

create policy suppliers_select on public.suppliers for select
  using (company_id in (select public.user_company_ids()) and public.has_permission('suppliers.view'));
create policy suppliers_insert on public.suppliers for insert
  with check (company_id in (select public.user_company_ids()) and public.has_permission('suppliers.create'));
create policy suppliers_update on public.suppliers for update
  using (company_id in (select public.user_company_ids()) and public.has_permission('suppliers.update'))
  with check (company_id in (select public.user_company_ids()) and public.has_permission('suppliers.update'));
create policy suppliers_delete on public.suppliers for delete
  using (company_id in (select public.user_company_ids()) and public.has_permission('suppliers.delete'));

create policy supplier_contacts_select on public.supplier_contacts for select
  using (company_id in (select public.user_company_ids()) and public.has_permission('suppliers.view'));
create policy supplier_contacts_insert on public.supplier_contacts for insert
  with check (company_id in (select public.user_company_ids()) and public.has_permission('suppliers.update'));
create policy supplier_contacts_update on public.supplier_contacts for update
  using (company_id in (select public.user_company_ids()) and public.has_permission('suppliers.update'))
  with check (company_id in (select public.user_company_ids()) and public.has_permission('suppliers.update'));
create policy supplier_contacts_delete on public.supplier_contacts for delete
  using (company_id in (select public.user_company_ids()) and public.has_permission('suppliers.delete'));

-- Servicios: sin permisos propios en el catálogo; se gestionan bajo settings.manage
-- (catálogo de la empresa) y se leen ampliamente (cualquier usuario autenticado de
-- la empresa necesita ver servicios para cotizar/facturar).
create policy service_categories_select on public.service_categories for select
  using (company_id in (select public.user_company_ids()));
create policy service_categories_write on public.service_categories for all
  using (company_id in (select public.user_company_ids()) and public.has_permission('settings.manage'))
  with check (company_id in (select public.user_company_ids()) and public.has_permission('settings.manage'));

create policy services_select on public.services for select
  using (company_id in (select public.user_company_ids()));
create policy services_write on public.services for all
  using (company_id in (select public.user_company_ids()) and public.has_permission('settings.manage'))
  with check (company_id in (select public.user_company_ids()) and public.has_permission('settings.manage'));
