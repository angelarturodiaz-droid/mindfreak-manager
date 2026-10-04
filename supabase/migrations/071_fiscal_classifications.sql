-- 071: Tratamiento fiscal de proveedores — fase 1 (ver
-- claude/propuesta-tratamiento-fiscal.md).
--
-- * fiscal_classifications: catálogo parametrizable de clasificaciones
--   fiscales del servicio (Servicio técnico, profesional, alquiler…). No
--   guarda porcentajes: Tipo de servicio → Clasificación → Regla fiscal.
-- * supplier_service_types.fiscal_classification_id: cada tipo de servicio
--   puede tener una clasificación (opcional; sin clasificar = el motor
--   avisará que falta).
--
-- No cambia ningún dato existente. Idempotente.

create table if not exists public.fiscal_classifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  code text not null check (code ~ '^[A-Z0-9_]{2,40}$'),
  name text not null check (length(btrim(name)) between 2 and 80),
  description text,
  is_active boolean not null default true,
  position integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_fiscal_classifications_code
  on public.fiscal_classifications (company_id, code);
create unique index if not exists uq_fiscal_classifications_name
  on public.fiscal_classifications (company_id, public.catalog_key(name));

drop trigger if exists set_updated_at on public.fiscal_classifications;
create trigger set_updated_at before update on public.fiscal_classifications
  for each row execute function public.set_updated_at();

alter table public.fiscal_classifications enable row level security;

drop policy if exists fiscal_classifications_select on public.fiscal_classifications;
create policy fiscal_classifications_select on public.fiscal_classifications for select
  using (company_id in (select public.user_company_ids()));

drop policy if exists fiscal_classifications_insert on public.fiscal_classifications;
create policy fiscal_classifications_insert on public.fiscal_classifications for insert
  with check (company_id in (select public.user_company_ids()) and public.has_permission('settings.manage'));

drop policy if exists fiscal_classifications_update on public.fiscal_classifications;
create policy fiscal_classifications_update on public.fiscal_classifications for update
  using (company_id in (select public.user_company_ids()) and public.has_permission('settings.manage'))
  with check (company_id in (select public.user_company_ids()) and public.has_permission('settings.manage'));

-- Sin delete: se desactivan (las reglas y gastos guardan referencias).

alter table public.supplier_service_types
  add column if not exists fiscal_classification_id uuid
    references public.fiscal_classifications (id) on delete set null;

create index if not exists idx_supplier_service_types_fiscal_class
  on public.supplier_service_types (fiscal_classification_id);

insert into public.fiscal_classifications (company_id, code, name, description, position)
select c.id, v.code, v.name, v.description, v.position
from public.companies c
cross join (values
  ('SERVICIO_TECNICO', 'Servicio técnico', 'Oficios y servicios técnicos: instalación, montaje, mantenimiento, limpieza, transporte, carpintería, plomería, etc.', 10),
  ('SERVICIO_PROFESIONAL', 'Servicio profesional', 'Honorarios por servicios profesionales o liberales: consultoría, diseño, legal, contabilidad, ingeniería, producción artística.', 20),
  ('VENTA_BIENES', 'Venta de bienes', 'Compra de productos o materiales (no es un servicio).', 30),
  ('ALQUILER', 'Alquiler', 'Alquiler o arrendamiento de equipos, locales, vehículos u otros bienes.', 40),
  ('COMISION', 'Comisión', 'Comisiones por intermediación o ventas.', 50),
  ('SEGURIDAD_VIGILANCIA', 'Seguridad y vigilancia', 'Servicios de seguridad, vigilancia y protección.', 60),
  ('SERVICIO_EXENTO', 'Servicio exento', 'Servicios exentos de ITBIS según la ley (ej. salud, educación).', 70),
  ('OTRO', 'Otro', 'Otro tipo de operación con tratamiento fiscal definido por una regla.', 80),
  ('SIN_TRATAMIENTO', 'Sin tratamiento automático', 'El sistema no calcula retenciones: requiere revisión manual.', 90)
) as v(code, name, description, position)
on conflict (company_id, code) do nothing;
