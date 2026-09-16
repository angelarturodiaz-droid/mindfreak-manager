-- Dos bugs de RLS encontrados al construir el módulo de Usuarios y Roles,
-- antes de que llegaran a producción:
--
-- 1) profiles_update solo dejaba que cada usuario edite SU PROPIO perfil
--    (id = auth.uid()) — no servía para que un admin active/desactive a
--    OTRO usuario. Se agrega: puede editar el perfil de cualquier usuario
--    de su misma compañía si tiene el permiso 'users.manage'.
--
-- 2) role_permissions_insert/delete exigía que el rol tuviera
--    company_id propio (r.company_id in user_company_ids()) — pero los 5
--    roles base (ADMIN/MANAGER/SALES/FINANCE/OPERATIONS) son plantillas
--    GLOBALES con company_id = null, así que la condición nunca se
--    cumplía y la política rechazaba todo. Se agrega: también se permite
--    cuando el rol es una plantilla global (company_id is null). Nota: en
--    V1 solo hay una compañía usando esta instancia, así que esto no es
--    un problema práctico hoy; si en el futuro hay más de una compañía
--    compartiendo la misma instancia, editar una plantilla global las
--    afectaría a todas — documentado también en MANUAL_NOTES.md.

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update
  using (
    id = (select auth.uid())
    or (
      id in (
        select ur.user_id from public.user_roles ur
        where ur.company_id in (select public.user_company_ids())
      )
      and public.has_permission('users.manage')
    )
  )
  with check (
    id = (select auth.uid())
    or (
      id in (
        select ur.user_id from public.user_roles ur
        where ur.company_id in (select public.user_company_ids())
      )
      and public.has_permission('users.manage')
    )
  );

drop policy if exists role_permissions_insert on public.role_permissions;
create policy role_permissions_insert on public.role_permissions for insert
  with check (
    public.has_permission('users.manage')
    and exists (
      select 1 from public.roles r
      where r.id = role_permissions.role_id
        and (r.company_id in (select public.user_company_ids()) or r.company_id is null)
    )
  );

drop policy if exists role_permissions_delete on public.role_permissions;
create policy role_permissions_delete on public.role_permissions for delete
  using (
    public.has_permission('users.manage')
    and exists (
      select 1 from public.roles r
      where r.id = role_permissions.role_id
        and (r.company_id in (select public.user_company_ids()) or r.company_id is null)
    )
  );
