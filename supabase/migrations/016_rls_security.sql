-- F4: Políticas RLS — Seguridad/Multiempresa
-- Ver F0-Arquitectura, sección L (RLS)

-- companies: visible/editable solo si el usuario pertenece a ella
create policy companies_select on public.companies for select
  using (id in (select public.user_company_ids()));
create policy companies_update on public.companies for update
  using (id in (select public.user_company_ids()) and public.has_permission('settings.manage'))
  with check (id in (select public.user_company_ids()) and public.has_permission('settings.manage'));

-- profiles: cada quien ve su propio perfil, o el de un compañero de empresa
create policy profiles_select on public.profiles for select
  using (
    id = auth.uid()
    or id in (
      select ur.user_id from public.user_roles ur
      where ur.company_id in (select public.user_company_ids())
    )
  );
create policy profiles_update on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- roles: catálogo global (company_id null) visible a todos; roles propios de la empresa también
create policy roles_select on public.roles for select
  using (company_id is null or company_id in (select public.user_company_ids()));
create policy roles_insert on public.roles for insert
  with check (company_id in (select public.user_company_ids()) and public.has_permission('users.manage'));
create policy roles_update on public.roles for update
  using (company_id in (select public.user_company_ids()) and public.has_permission('users.manage'))
  with check (company_id in (select public.user_company_ids()) and public.has_permission('users.manage'));
create policy roles_delete on public.roles for delete
  using (company_id in (select public.user_company_ids()) and public.has_permission('users.manage'));

-- permissions: catálogo global de solo lectura para la app (se modifica vía migraciones)
create policy permissions_select on public.permissions for select
  using (true);

-- role_permissions: lectura abierta (necesaria para resolver permisos en UI);
-- escritura solo sobre roles de la propia empresa
create policy role_permissions_select on public.role_permissions for select
  using (true);
create policy role_permissions_insert on public.role_permissions for insert
  with check (
    public.has_permission('users.manage')
    and exists (
      select 1 from public.roles r
      where r.id = role_permissions.role_id
        and r.company_id in (select public.user_company_ids())
    )
  );
create policy role_permissions_delete on public.role_permissions for delete
  using (
    public.has_permission('users.manage')
    and exists (
      select 1 from public.roles r
      where r.id = role_permissions.role_id
        and r.company_id in (select public.user_company_ids())
    )
  );

-- user_roles: cada quien ve sus propias asignaciones; users.manage ve/gestiona las de su empresa
create policy user_roles_select on public.user_roles for select
  using (
    user_id = auth.uid()
    or (company_id in (select public.user_company_ids()) and public.has_permission('users.manage'))
  );
create policy user_roles_insert on public.user_roles for insert
  with check (company_id in (select public.user_company_ids()) and public.has_permission('users.manage'));
create policy user_roles_delete on public.user_roles for delete
  using (company_id in (select public.user_company_ids()) and public.has_permission('users.manage'));
