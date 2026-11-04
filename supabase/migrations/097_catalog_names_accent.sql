-- 097 — Listas sin repetidos aunque cambie un acento o un espacio.
--
-- «Almacen» y «Almacén», «Higuey» e «Higüey», «bodas» y «Bodas  » cuentan como el mismo nombre.
-- Usa public.catalog_key(name) (066: minúsculas, sin acentos, espacios normalizados), igual que
-- categorías y tipos de servicio. Aplica a: ubicaciones y tipos de Activos, zonas y etiquetas del Directorio.
-- Solo agrega índices (no cambia ni borra datos). Antes de aplicarla se verificó que no hubiera repetidos.

create unique index if not exists uq_asset_locations_key on public.asset_locations(company_id, public.catalog_key(name));
create unique index if not exists uq_asset_types_key on public.asset_types(company_id, public.catalog_key(name));
create unique index if not exists uq_directory_zones_key on public.directory_zones(company_id, public.catalog_key(name));
create unique index if not exists uq_directory_tags_key on public.directory_tags(company_id, public.catalog_key(name));
