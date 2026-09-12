-- F19: el permiso 'reports.view' existía en el catálogo desde F0/F4 pero
-- ninguna política RLS lo usaba — alguien con reports.view pero sin
-- invoices.view/expenses.view/etc. vería los reportes vacíos, ya que RLS es
-- la última línea de defensa y bloquearía la lectura de esas tablas. Se
-- amplían las políticas de SELECT relevantes para aceptar reports.view como
-- alternativa al permiso específico del módulo.

drop policy if exists quotations_select on public.quotations;
create policy quotations_select on public.quotations for select
  using (
    company_id in (select public.user_company_ids())
    and (public.has_permission('quotations.view') or public.has_permission('reports.view'))
  );

drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects for select
  using (
    company_id in (select public.user_company_ids())
    and (public.has_permission('projects.view') or public.has_permission('reports.view'))
  );

drop policy if exists project_items_select on public.project_items;
create policy project_items_select on public.project_items for select
  using (exists (
    select 1 from public.projects pr
    where pr.id = project_items.project_id
      and pr.company_id in (select public.user_company_ids())
      and (public.has_permission('projects.view') or public.has_permission('reports.view'))
  ));

drop policy if exists invoices_select on public.invoices;
create policy invoices_select on public.invoices for select
  using (
    company_id in (select public.user_company_ids())
    and (public.has_permission('invoices.view') or public.has_permission('reports.view'))
  );

drop policy if exists invoice_items_select on public.invoice_items;
create policy invoice_items_select on public.invoice_items for select
  using (exists (
    select 1 from public.invoices i
    where i.id = invoice_items.invoice_id
      and i.company_id in (select public.user_company_ids())
      and (public.has_permission('invoices.view') or public.has_permission('reports.view'))
  ));

drop policy if exists customer_payments_select on public.customer_payments;
create policy customer_payments_select on public.customer_payments for select
  using (
    company_id in (select public.user_company_ids())
    and (public.has_permission('payments.view') or public.has_permission('reports.view'))
  );

drop policy if exists expenses_select on public.expenses;
create policy expenses_select on public.expenses for select
  using (
    company_id in (select public.user_company_ids())
    and (public.has_permission('expenses.view') or public.has_permission('reports.view'))
  );
