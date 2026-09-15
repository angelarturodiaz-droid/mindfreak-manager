-- Catálogo de bancos (para dropdown en vez de texto libre) — pedido por el
-- usuario: al crear un Proveedor o una Cuenta bancaria, elegir el banco de
-- una lista en vez de escribirlo cada vez distinto ("Banreservas" vs.
-- "banreservas" vs. "BanReservas"). Se deja prellenado con los bancos más
-- comunes de República Dominicana; administrable desde Configuración.

create table if not exists public.bank_catalog (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, name)
);

create index if not exists idx_bank_catalog_company on public.bank_catalog (company_id);

alter table public.bank_catalog enable row level security;

create policy bank_catalog_select on public.bank_catalog for select
  using (company_id in (select public.user_company_ids()));

create policy bank_catalog_insert on public.bank_catalog for insert
  with check (company_id in (select public.user_company_ids()) and public.has_permission('settings.manage'));

create policy bank_catalog_update on public.bank_catalog for update
  using (company_id in (select public.user_company_ids()) and public.has_permission('settings.manage'))
  with check (company_id in (select public.user_company_ids()) and public.has_permission('settings.manage'));

create policy bank_catalog_delete on public.bank_catalog for delete
  using (company_id in (select public.user_company_ids()) and public.has_permission('settings.manage'));

create trigger set_updated_at
  before update on public.bank_catalog
  for each row
  execute function public.set_updated_at();

-- Prellenado con bancos comunes de RD para cada compañía existente.
insert into public.bank_catalog (company_id, name)
select c.id, b.name
from public.companies c
cross join (values
  ('Banreservas'),
  ('Banco Popular Dominicano'),
  ('Banco BHD'),
  ('Scotiabank'),
  ('Banco Santa Cruz'),
  ('Banco Caribe'),
  ('Banco Vimenca'),
  ('Asociación Popular de Ahorros y Préstamos (APAP)'),
  ('Asociación Cibao de Ahorros y Préstamos'),
  ('Banco Promerica'),
  ('Banco Lafise'),
  ('Otro')
) as b(name)
on conflict (company_id, name) do nothing;
