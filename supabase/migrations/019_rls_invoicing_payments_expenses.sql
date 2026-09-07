-- F4: Políticas RLS — Facturación, Cobros, Gastos, Pagos a Proveedores
-- Nota: sin permisos .update/.delete dedicados en el catálogo actual para
-- invoices/customer_payments/supplier_payments (ver F0 sección K: catálogo se
-- amplía por módulo). Se usa .create también para editar hasta que F10-F13
-- definan permisos más finos si hace falta.

create policy invoices_select on public.invoices for select
  using (company_id in (select public.user_company_ids()) and public.has_permission('invoices.view'));
create policy invoices_insert on public.invoices for insert
  with check (company_id in (select public.user_company_ids()) and public.has_permission('invoices.create'));
create policy invoices_update on public.invoices for update
  using (company_id in (select public.user_company_ids()) and public.has_permission('invoices.create'))
  with check (company_id in (select public.user_company_ids()) and public.has_permission('invoices.create'));

create policy invoice_items_select on public.invoice_items for select
  using (exists (
    select 1 from public.invoices i
    where i.id = invoice_items.invoice_id
      and i.company_id in (select public.user_company_ids())
      and public.has_permission('invoices.view')
  ));
create policy invoice_items_write on public.invoice_items for all
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

-- Cobros (customer_payments): "payments.*" cubre cobros y pagos a proveedores
-- por diseño (sección 9 del prompt maestro no distingue ambos).
create policy customer_payments_select on public.customer_payments for select
  using (company_id in (select public.user_company_ids()) and public.has_permission('payments.view'));
create policy customer_payments_insert on public.customer_payments for insert
  with check (company_id in (select public.user_company_ids()) and public.has_permission('payments.create'));

-- Gastos
create policy expense_categories_select on public.expense_categories for select
  using (company_id in (select public.user_company_ids()));
create policy expense_categories_write on public.expense_categories for all
  using (company_id in (select public.user_company_ids()) and public.has_permission('settings.manage'))
  with check (company_id in (select public.user_company_ids()) and public.has_permission('settings.manage'));

create policy expenses_select on public.expenses for select
  using (company_id in (select public.user_company_ids()) and public.has_permission('expenses.view'));
create policy expenses_insert on public.expenses for insert
  with check (company_id in (select public.user_company_ids()) and public.has_permission('expenses.create'));
create policy expenses_update on public.expenses for update
  using (company_id in (select public.user_company_ids()) and (public.has_permission('expenses.create') or public.has_permission('expenses.approve')))
  with check (company_id in (select public.user_company_ids()) and (public.has_permission('expenses.create') or public.has_permission('expenses.approve')));

-- Pagos a proveedores
create policy supplier_payments_select on public.supplier_payments for select
  using (company_id in (select public.user_company_ids()) and public.has_permission('payments.view'));
create policy supplier_payments_insert on public.supplier_payments for insert
  with check (company_id in (select public.user_company_ids()) and public.has_permission('payments.create'));
