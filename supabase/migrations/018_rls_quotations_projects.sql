-- F4: Políticas RLS — Cotizaciones y Proyectos/Eventos
-- Nota: la regla fina de "solo quotations.approve puede cambiar status a APPROVED"
-- se aplica a nivel de Server Action/trigger en F8, no en esta política de tabla.

create policy quotations_select on public.quotations for select
  using (company_id in (select public.user_company_ids()) and public.has_permission('quotations.view'));
create policy quotations_insert on public.quotations for insert
  with check (company_id in (select public.user_company_ids()) and public.has_permission('quotations.create'));
create policy quotations_update on public.quotations for update
  using (company_id in (select public.user_company_ids()) and (public.has_permission('quotations.update') or public.has_permission('quotations.approve')))
  with check (company_id in (select public.user_company_ids()) and (public.has_permission('quotations.update') or public.has_permission('quotations.approve')));

create policy quotation_items_select on public.quotation_items for select
  using (exists (
    select 1 from public.quotations q
    where q.id = quotation_items.quotation_id
      and q.company_id in (select public.user_company_ids())
      and public.has_permission('quotations.view')
  ));
create policy quotation_items_write on public.quotation_items for all
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

create policy projects_select on public.projects for select
  using (company_id in (select public.user_company_ids()) and public.has_permission('projects.view'));
create policy projects_insert on public.projects for insert
  with check (company_id in (select public.user_company_ids()) and public.has_permission('projects.create'));
create policy projects_update on public.projects for update
  using (company_id in (select public.user_company_ids()) and public.has_permission('projects.update'))
  with check (company_id in (select public.user_company_ids()) and public.has_permission('projects.update'));

create policy project_items_select on public.project_items for select
  using (exists (
    select 1 from public.projects pr
    where pr.id = project_items.project_id
      and pr.company_id in (select public.user_company_ids())
      and public.has_permission('projects.view')
  ));
create policy project_items_write on public.project_items for all
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
