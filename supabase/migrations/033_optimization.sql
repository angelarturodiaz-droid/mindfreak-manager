-- F22 — Optimización. Basado en los *advisors* de rendimiento de Supabase
-- (revisados a propósito en esta fase, ver nota de deuda técnica desde F3).
--
-- A) auth_rls_initplan (WARN, 8 hallazgos): varias políticas llaman
--    auth.uid() directo en vez de (select auth.uid()) — Postgres lo
--    re-evalúa por cada fila en vez de una sola vez por consulta.
-- B) multiple_permissive_policies (WARN, 45 hallazgos): 9 tablas tienen
--    una política "_select" Y una "_write" (FOR ALL) que también cubre
--    SELECT — Postgres evalúa ambas en cada lectura. Se separan las
--    políticas "_write" en insert/update/delete explícitos (sin select).
-- C) unindexed_foreign_keys (INFO, 61 hallazgos): FKs sin índice de
--    cobertura — ya identificado como deuda técnica desde F3, se corrige
--    ahora con datos reales de uso disponibles.
--
-- No se tocan los "unused_index" (INFO, 7 hallazgos) — es normal y
-- esperado en una base de datos con poco tráfico real todavía; no hay
-- motivo para borrar índices que se van a necesitar según crezca el uso.

-- ============================================================
-- A) auth_rls_initplan — envolver auth.uid() en (select ...)
-- ============================================================

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (
    id = (select auth.uid())
    or id in (
      select ur.user_id from public.user_roles ur
      where ur.company_id in (select public.user_company_ids())
    )
  );

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists user_roles_select on public.user_roles;
create policy user_roles_select on public.user_roles for select
  using (
    user_id = (select auth.uid())
    or (company_id in (select public.user_company_ids()) and public.has_permission('users.manage'))
  );

drop policy if exists approvals_select on public.approvals;
create policy approvals_select on public.approvals for select
  using (
    company_id in (select public.user_company_ids())
    and (
      requested_by = (select auth.uid())
      or approver_id = (select auth.uid())
      or public.has_permission('users.manage')
    )
  );

drop policy if exists approvals_update on public.approvals;
create policy approvals_update on public.approvals for update
  using (
    company_id in (select public.user_company_ids())
    and (approver_id = (select auth.uid()) or public.has_permission('users.manage'))
  )
  with check (
    company_id in (select public.user_company_ids())
    and (approver_id = (select auth.uid()) or public.has_permission('users.manage'))
  );

drop policy if exists audit_logs_insert on public.audit_logs;
create policy audit_logs_insert on public.audit_logs for insert
  with check (
    company_id in (select public.user_company_ids())
    and user_id = (select auth.uid())
  );

drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications for select
  using (user_id = (select auth.uid()));

drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications for update
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ============================================================
-- B) multiple_permissive_policies — separar "_write" (FOR ALL) en
--    insert/update/delete explícitos, sin volver a cubrir SELECT
-- ============================================================

-- service_categories
drop policy if exists service_categories_write on public.service_categories;
create policy service_categories_insert on public.service_categories for insert
  with check (company_id in (select public.user_company_ids()) and public.has_permission('settings.manage'));
create policy service_categories_update on public.service_categories for update
  using (company_id in (select public.user_company_ids()) and public.has_permission('settings.manage'))
  with check (company_id in (select public.user_company_ids()) and public.has_permission('settings.manage'));
create policy service_categories_delete on public.service_categories for delete
  using (company_id in (select public.user_company_ids()) and public.has_permission('settings.manage'));

-- services
drop policy if exists services_write on public.services;
create policy services_insert on public.services for insert
  with check (company_id in (select public.user_company_ids()) and public.has_permission('settings.manage'));
create policy services_update on public.services for update
  using (company_id in (select public.user_company_ids()) and public.has_permission('settings.manage'))
  with check (company_id in (select public.user_company_ids()) and public.has_permission('settings.manage'));
create policy services_delete on public.services for delete
  using (company_id in (select public.user_company_ids()) and public.has_permission('settings.manage'));

-- expense_categories
drop policy if exists expense_categories_write on public.expense_categories;
create policy expense_categories_insert on public.expense_categories for insert
  with check (company_id in (select public.user_company_ids()) and public.has_permission('settings.manage'));
create policy expense_categories_update on public.expense_categories for update
  using (company_id in (select public.user_company_ids()) and public.has_permission('settings.manage'))
  with check (company_id in (select public.user_company_ids()) and public.has_permission('settings.manage'));
create policy expense_categories_delete on public.expense_categories for delete
  using (company_id in (select public.user_company_ids()) and public.has_permission('settings.manage'));

-- exchange_rates
drop policy if exists exchange_rates_write on public.exchange_rates;
create policy exchange_rates_insert on public.exchange_rates for insert
  with check (company_id in (select public.user_company_ids()) and public.has_permission('settings.manage'));
create policy exchange_rates_update on public.exchange_rates for update
  using (company_id in (select public.user_company_ids()) and public.has_permission('settings.manage'))
  with check (company_id in (select public.user_company_ids()) and public.has_permission('settings.manage'));
create policy exchange_rates_delete on public.exchange_rates for delete
  using (company_id in (select public.user_company_ids()) and public.has_permission('settings.manage'));

-- settings
drop policy if exists settings_write on public.settings;
create policy settings_insert on public.settings for insert
  with check (company_id in (select public.user_company_ids()) and public.has_permission('settings.manage'));
create policy settings_update on public.settings for update
  using (company_id in (select public.user_company_ids()) and public.has_permission('settings.manage'))
  with check (company_id in (select public.user_company_ids()) and public.has_permission('settings.manage'));
create policy settings_delete on public.settings for delete
  using (company_id in (select public.user_company_ids()) and public.has_permission('settings.manage'));

-- tax_rates
drop policy if exists tax_rates_write on public.tax_rates;
create policy tax_rates_insert on public.tax_rates for insert
  with check (company_id in (select public.user_company_ids()) and public.has_permission('settings.manage'));
create policy tax_rates_update on public.tax_rates for update
  using (company_id in (select public.user_company_ids()) and public.has_permission('settings.manage'))
  with check (company_id in (select public.user_company_ids()) and public.has_permission('settings.manage'));
create policy tax_rates_delete on public.tax_rates for delete
  using (company_id in (select public.user_company_ids()) and public.has_permission('settings.manage'));

-- quotation_items (lógica vía EXISTS sobre quotations, no company_id directo)
drop policy if exists quotation_items_write on public.quotation_items;
create policy quotation_items_insert on public.quotation_items for insert
  with check (exists (
    select 1 from public.quotations q
    where q.id = quotation_items.quotation_id
      and q.company_id in (select public.user_company_ids())
      and public.has_permission('quotations.update')
  ));
create policy quotation_items_update on public.quotation_items for update
  using (exists (
    select 1 from public.quotations q
    where q.id = quotation_items.quotation_id
      and q.company_id in (select public.user_company_ids())
      and public.has_permission('quotations.update')
  ))
  with check (exists (
    select 1 from public.quotations q
    where q.id = quotation_items.quotation_id
      and q.company_id in (select public.user_company_ids())
      and public.has_permission('quotations.update')
  ));
create policy quotation_items_delete on public.quotation_items for delete
  using (exists (
    select 1 from public.quotations q
    where q.id = quotation_items.quotation_id
      and q.company_id in (select public.user_company_ids())
      and public.has_permission('quotations.update')
  ));

-- project_items
drop policy if exists project_items_write on public.project_items;
create policy project_items_insert on public.project_items for insert
  with check (exists (
    select 1 from public.projects pr
    where pr.id = project_items.project_id
      and pr.company_id in (select public.user_company_ids())
      and public.has_permission('projects.update')
  ));
create policy project_items_update on public.project_items for update
  using (exists (
    select 1 from public.projects pr
    where pr.id = project_items.project_id
      and pr.company_id in (select public.user_company_ids())
      and public.has_permission('projects.update')
  ))
  with check (exists (
    select 1 from public.projects pr
    where pr.id = project_items.project_id
      and pr.company_id in (select public.user_company_ids())
      and public.has_permission('projects.update')
  ));
create policy project_items_delete on public.project_items for delete
  using (exists (
    select 1 from public.projects pr
    where pr.id = project_items.project_id
      and pr.company_id in (select public.user_company_ids())
      and public.has_permission('projects.update')
  ));

-- invoice_items
drop policy if exists invoice_items_write on public.invoice_items;
create policy invoice_items_insert on public.invoice_items for insert
  with check (exists (
    select 1 from public.invoices i
    where i.id = invoice_items.invoice_id
      and i.company_id in (select public.user_company_ids())
      and public.has_permission('invoices.create')
  ));
create policy invoice_items_update on public.invoice_items for update
  using (exists (
    select 1 from public.invoices i
    where i.id = invoice_items.invoice_id
      and i.company_id in (select public.user_company_ids())
      and public.has_permission('invoices.create')
  ))
  with check (exists (
    select 1 from public.invoices i
    where i.id = invoice_items.invoice_id
      and i.company_id in (select public.user_company_ids())
      and public.has_permission('invoices.create')
  ));
create policy invoice_items_delete on public.invoice_items for delete
  using (exists (
    select 1 from public.invoices i
    where i.id = invoice_items.invoice_id
      and i.company_id in (select public.user_company_ids())
      and public.has_permission('invoices.create')
  ));

-- ============================================================
-- C) unindexed_foreign_keys — 61 índices de cobertura faltantes
-- ============================================================

create index if not exists idx_activities_company_id on public.activities (company_id);
create index if not exists idx_activities_created_by on public.activities (created_by);
create index if not exists idx_approvals_approver_id on public.approvals (approver_id);
create index if not exists idx_approvals_company_id on public.approvals (company_id);
create index if not exists idx_approvals_requested_by on public.approvals (requested_by);
create index if not exists idx_audit_logs_company_id on public.audit_logs (company_id);
create index if not exists idx_audit_logs_user_id on public.audit_logs (user_id);
create index if not exists idx_bank_transactions_client_id on public.bank_transactions (client_id);
create index if not exists idx_bank_transactions_company_id on public.bank_transactions (company_id);
create index if not exists idx_bank_transactions_customer_payment_id on public.bank_transactions (customer_payment_id);
create index if not exists idx_bank_transactions_expense_id on public.bank_transactions (expense_id);
create index if not exists idx_bank_transactions_supplier_id on public.bank_transactions (supplier_id);
create index if not exists idx_bank_transactions_supplier_payment_id on public.bank_transactions (supplier_payment_id);
create index if not exists idx_client_contacts_company_id on public.client_contacts (company_id);
create index if not exists idx_clients_created_by on public.clients (created_by);
create index if not exists idx_customer_payments_bank_account_id on public.customer_payments (bank_account_id);
create index if not exists idx_customer_payments_client_id on public.customer_payments (client_id);
create index if not exists idx_customer_payments_company_id on public.customer_payments (company_id);
create index if not exists idx_customer_payments_created_by on public.customer_payments (created_by);
create index if not exists idx_customer_payments_document_id on public.customer_payments (document_id);
create index if not exists idx_documents_company_id on public.documents (company_id);
create index if not exists idx_documents_uploaded_by on public.documents (uploaded_by);
create index if not exists idx_exchange_rates_created_by on public.exchange_rates (created_by);
create index if not exists idx_expense_categories_company_id on public.expense_categories (company_id);
create index if not exists idx_expenses_bank_account_id on public.expenses (bank_account_id);
create index if not exists idx_expenses_category_id on public.expenses (category_id);
create index if not exists idx_expenses_company_id on public.expenses (company_id);
create index if not exists idx_expenses_created_by on public.expenses (created_by);
create index if not exists idx_expenses_document_id on public.expenses (document_id);
create index if not exists idx_import_batches_company_id on public.import_batches (company_id);
create index if not exists idx_import_batches_created_by on public.import_batches (created_by);
create index if not exists idx_invoice_items_service_id on public.invoice_items (service_id);
create index if not exists idx_invoice_items_tax_rate_id on public.invoice_items (tax_rate_id);
create index if not exists idx_invoices_created_by on public.invoices (created_by);
create index if not exists idx_invoices_quotation_id on public.invoices (quotation_id);
create index if not exists idx_notifications_company_id on public.notifications (company_id);
create index if not exists idx_project_items_service_id on public.project_items (service_id);
create index if not exists idx_projects_contact_id on public.projects (contact_id);
create index if not exists idx_projects_created_by on public.projects (created_by);
create index if not exists idx_projects_manager_id on public.projects (manager_id);
create index if not exists idx_projects_quotation_id on public.projects (quotation_id);
create index if not exists idx_quotation_items_service_id on public.quotation_items (service_id);
create index if not exists idx_quotation_items_tax_rate_id on public.quotation_items (tax_rate_id);
create index if not exists idx_quotations_project_id on public.quotations (project_id);
create index if not exists idx_quotations_approved_by on public.quotations (approved_by);
create index if not exists idx_quotations_contact_id on public.quotations (contact_id);
create index if not exists idx_quotations_created_by on public.quotations (created_by);
create index if not exists idx_role_permissions_permission_id on public.role_permissions (permission_id);
create index if not exists idx_service_categories_company_id on public.service_categories (company_id);
create index if not exists idx_services_category_id on public.services (category_id);
create index if not exists idx_settings_updated_by on public.settings (updated_by);
create index if not exists idx_supplier_contacts_company_id on public.supplier_contacts (company_id);
create index if not exists idx_supplier_payments_document_id on public.supplier_payments (document_id);
create index if not exists idx_supplier_payments_bank_account_id on public.supplier_payments (bank_account_id);
create index if not exists idx_supplier_payments_company_id on public.supplier_payments (company_id);
create index if not exists idx_supplier_payments_created_by on public.supplier_payments (created_by);
create index if not exists idx_supplier_payments_project_id on public.supplier_payments (project_id);
create index if not exists idx_suppliers_created_by on public.suppliers (created_by);
create index if not exists idx_tasks_company_id on public.tasks (company_id);
create index if not exists idx_tasks_created_by on public.tasks (created_by);
create index if not exists idx_user_roles_role_id on public.user_roles (role_id);
