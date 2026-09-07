-- F4: Función auxiliar reutilizable para RLS — las compañías a las que
-- pertenece el usuario autenticado. Evita repetir la subconsulta a user_roles
-- en las políticas de las 32 tablas.

create or replace function public.user_company_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select company_id from public.user_roles where user_id = auth.uid();
$$;

revoke execute on function public.user_company_ids() from public, anon;
