-- 5-nov: categorías de Productos y Servicios
-- 1) Sin nombres repetidos (no cuentan mayúsculas, acentos ni espacios), igual que las demás listas (066/097).
--    Se hace con trigger y no con índice único para no fallar por los repetidos que ya existen (ej. «Capacitacion» ×2):
--    esos se arreglan borrando el vacío desde la pantalla.
-- 2) No se puede borrar una categoría que tiene productos o servicios (aunque estén inactivos).

create or replace function public.service_categories_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if exists (select 1 from public.services s where s.category_id = old.id) then
      raise exception 'category_in_use: la categoría «%» tiene productos o servicios; muévelos a otra antes de borrarla.', old.name
        using errcode = 'P0001';
    end if;
    return old;
  end if;
  -- Cambiar solo la descripción (o mayúsculas/acentos del mismo nombre) no se bloquea.
  if tg_op = 'UPDATE' and public.catalog_key(new.name) = public.catalog_key(old.name) then
    return new;
  end if;
  if exists (
    select 1 from public.service_categories c
    where c.company_id = new.company_id
      and c.id <> new.id
      and public.catalog_key(c.name) = public.catalog_key(new.name)
  ) then
    raise exception 'duplicate category name: %', new.name using errcode = '23505';
  end if;
  return new;
end;
$$;

drop trigger if exists service_categories_guard_write on public.service_categories;
create trigger service_categories_guard_write
  before insert or update of name on public.service_categories
  for each row execute function public.service_categories_guard();

drop trigger if exists service_categories_guard_delete on public.service_categories;
create trigger service_categories_guard_delete
  before delete on public.service_categories
  for each row execute function public.service_categories_guard();
