-- 085c — Lista de permisos del usuario actual (para mostrar solo el menú y
-- los botones que puede usar). Misma regla que has_permission(): perfil
-- activo y verificación en dos pasos activada.
create or replace function public.my_permissions()
returns text[]
language sql
stable security definer
set search_path to 'public'
as $function$
  select coalesce(array_agg(distinct p.code order by p.code), '{}')
  from public.user_roles ur
  join public.role_permissions rp on rp.role_id = ur.role_id
  join public.permissions p on p.id = rp.permission_id
  join public.profiles pr on pr.id = ur.user_id and pr.is_active
  where ur.user_id = auth.uid()
    and exists (
      select 1 from auth.mfa_factors f
      where f.user_id = auth.uid() and f.status = 'verified'
    );
$function$;

revoke all on function public.my_permissions() from public, anon;
grant execute on function public.my_permissions() to authenticated;
