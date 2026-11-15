-- País, estado/provincia y ciudad del cliente (15-nov-2026). Hasta hoy el cliente solo tenía Provincia y Municipio de
-- la DGII (solo República Dominicana). Ahora: País (por defecto RD) y, si es de otro país, Estado / provincia y Ciudad
-- en texto. Provincia y Municipio de la DGII quedan solo para RD. No toca reglas fiscales ni cálculos.
alter table public.clients
  add column if not exists country_code text not null default 'DO',
  add column if not exists region text,
  add column if not exists city text;

alter table public.clients drop constraint if exists clients_country_code_check;
alter table public.clients add constraint clients_country_code_check check (country_code ~ '^[A-Z]{2}$');

alter table public.clients drop constraint if exists clients_region_city_length_check;
alter table public.clients add constraint clients_region_city_length_check
  check (coalesce(length(region), 0) <= 80 and coalesce(length(city), 0) <= 80);

-- Provincia y municipio de la DGII solo para clientes de RD.
alter table public.clients drop constraint if exists clients_dgii_place_only_do_check;
alter table public.clients add constraint clients_dgii_place_only_do_check
  check (country_code = 'DO' or (province_code is null and municipality_code is null));

comment on column public.clients.country_code is 'País del cliente (ISO 3166-1 alfa-2). DO = República Dominicana.';
comment on column public.clients.region is 'Estado / provincia del cliente cuando no es de RD (texto).';
comment on column public.clients.city is 'Ciudad del cliente cuando no es de RD (texto).';
