-- Categorías y tipos de servicio sin nombres repetidos (2026-09-29).
--
-- Dos nombres que solo cambian en mayúsculas, acentos o espacios cuentan
-- como el mismo ("Decoracion" = "Decoración" = " decoración ").
-- * Categorías (expense_categories): únicas por empresa.
-- * Tipos de servicio (supplier_service_types): únicos por empresa, en
--   cualquier categoría (un tipo vive en una sola categoría).
-- La pantalla ya avisa antes de guardar; esto es la garantía en la base de
-- datos (también para importaciones y cualquier otra vía).
--
-- Idempotente.

create or replace function public.catalog_key(p_name text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $function$
  select lower(translate(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g'),
                         'áéíóúüñÁÉÍÓÚÜÑàèìòùÀÈÌÒÙ', 'aeiouunAEIOUUNaeiouAEIOU'))
$function$;

create unique index if not exists expense_categories_company_catalog_key
  on public.expense_categories (company_id, public.catalog_key(name));

create unique index if not exists supplier_service_types_company_catalog_key
  on public.supplier_service_types (company_id, public.catalog_key(name));
