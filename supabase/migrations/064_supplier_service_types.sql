-- Proveedores con Categoría y Tipo de servicio de catálogo (2026-09-27).
--
-- * Categoría del proveedor: la misma lista de Configuración > Categorías
--   (expense_categories). Ej. Sonus Eventos → Audiovisuales.
-- * Tipo de servicio: catálogo nuevo en Configuración > Tipos de servicio.
--   Cada tipo pertenece a una categoría (Audiovisuales → Alquiler de
--   sonido, Alquiler de pantallas…).
-- * suppliers.category_id / service_type_id son la referencia; las columnas
--   de texto category / service_type se siguen llenando con los nombres
--   para que listados, filtros e importación existentes no cambien.
-- * Al registrar un gasto, la categoría del proveedor se sugiere sola.
--
-- Datos existentes: los textos de categoría/tipo de servicio que ya tienen
-- los proveedores se enlazan con el catálogo (sin distinguir mayúsculas ni
-- acentos); si no existen, se crean para no perder información.
--
-- Idempotente.

create table if not exists public.supplier_service_types (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  category_id uuid not null references public.expense_categories (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists supplier_service_types_unique_name
  on public.supplier_service_types (company_id, category_id, lower(name));
create index if not exists idx_supplier_service_types_category
  on public.supplier_service_types (category_id);

drop trigger if exists set_updated_at on public.supplier_service_types;
create trigger set_updated_at
  before update on public.supplier_service_types
  for each row execute function public.set_updated_at();

alter table public.supplier_service_types enable row level security;

drop policy if exists supplier_service_types_select on public.supplier_service_types;
create policy supplier_service_types_select on public.supplier_service_types
  for select using (company_id in (select public.user_company_ids()));

drop policy if exists supplier_service_types_insert on public.supplier_service_types;
create policy supplier_service_types_insert on public.supplier_service_types
  for insert with check (
    company_id in (select public.user_company_ids()) and public.has_permission('settings.manage')
  );

drop policy if exists supplier_service_types_update on public.supplier_service_types;
create policy supplier_service_types_update on public.supplier_service_types
  for update using (
    company_id in (select public.user_company_ids()) and public.has_permission('settings.manage')
  ) with check (
    company_id in (select public.user_company_ids()) and public.has_permission('settings.manage')
  );

drop policy if exists supplier_service_types_delete on public.supplier_service_types;
create policy supplier_service_types_delete on public.supplier_service_types
  for delete using (
    company_id in (select public.user_company_ids()) and public.has_permission('settings.manage')
  );

revoke all on public.supplier_service_types from anon;
grant select, insert, update, delete on public.supplier_service_types to authenticated, service_role;

alter table public.suppliers
  add column if not exists category_id uuid references public.expense_categories (id) on delete set null,
  add column if not exists service_type_id uuid references public.supplier_service_types (id) on delete set null;

create index if not exists idx_suppliers_category_id on public.suppliers (category_id);
create index if not exists idx_suppliers_service_type_id on public.suppliers (service_type_id);

-- Enlazar los textos existentes con el catálogo (creando lo que falte)
insert into public.expense_categories (company_id, name, description)
select distinct on (s.company_id, lower(translate(trim(s.category), 'áéíóúÁÉÍÓÚ', 'aeiouAEIOU')))
  s.company_id, trim(s.category), 'Creada desde la categoría de un proveedor'
from public.suppliers s
where coalesce(trim(s.category), '') <> ''
  and not exists (
    select 1 from public.expense_categories ec
    where ec.company_id = s.company_id
      and lower(translate(trim(ec.name), 'áéíóúÁÉÍÓÚ', 'aeiouAEIOU')) = lower(translate(trim(s.category), 'áéíóúÁÉÍÓÚ', 'aeiouAEIOU'))
  );

update public.suppliers s
set category_id = public.find_expense_category(s.company_id, trim(s.category))
where s.category_id is null
  and coalesce(trim(s.category), '') <> '';

insert into public.supplier_service_types (company_id, category_id, name)
select distinct on (s.company_id, s.category_id, lower(trim(s.service_type)))
  s.company_id, s.category_id, trim(s.service_type)
from public.suppliers s
where s.category_id is not null
  and coalesce(trim(s.service_type), '') <> ''
on conflict do nothing;

update public.suppliers s
set service_type_id = st.id
from public.supplier_service_types st
where s.service_type_id is null
  and s.category_id is not null
  and st.company_id = s.company_id
  and st.category_id = s.category_id
  and lower(st.name) = lower(trim(s.service_type));

-- Los textos quedan iguales a los nombres del catálogo
update public.suppliers s
set category = c.name
from public.expense_categories c
where s.category_id = c.id and s.category is distinct from c.name;

update public.suppliers s
set service_type = st.name
from public.supplier_service_types st
where s.service_type_id = st.id and s.service_type is distinct from st.name;
