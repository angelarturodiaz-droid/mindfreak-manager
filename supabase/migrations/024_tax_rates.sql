-- F10/F11 fix-round: Parametrización ligera de impuestos (ITBIS, etc.)
-- Ver F0-Arquitectura, sección R: la activación fiscal completa de NCF/ITBIS
-- (secuencias DGII, reportes) sigue siendo V2. Esto es solo una tabla de tasas
-- nombradas por compañía para que las líneas de cotización/factura calculen el
-- impuesto como % en vez de escribir el monto a mano.

create table if not exists public.tax_rates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  rate numeric(6, 3) not null check (rate >= 0),
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tax_rates_company on public.tax_rates (company_id);

-- Solo puede haber una tasa marcada como default por compañía.
create unique index if not exists uq_tax_rates_company_default
  on public.tax_rates (company_id)
  where is_default;

-- Referencia informativa/de auditoría en las líneas. El monto de impuesto
-- (`tax`) se sigue guardando congelado en la propia línea, igual que el resto
-- de campos financieros del sistema (no se recalcula si la tasa cambia después).
alter table public.quotation_items
  add column if not exists tax_rate_id uuid references public.tax_rates (id) on delete set null;
alter table public.invoice_items
  add column if not exists tax_rate_id uuid references public.tax_rates (id) on delete set null;

-- updated_at automático
drop trigger if exists set_updated_at on public.tax_rates;
create trigger set_updated_at before update on public.tax_rates
  for each row execute function public.set_updated_at();

-- RLS: lectura amplia dentro de la compañía (se necesita para cotizar/facturar),
-- escritura bajo settings.manage — mismo patrón que service_categories/services.
alter table public.tax_rates enable row level security;

create policy tax_rates_select on public.tax_rates for select
  using (company_id in (select public.user_company_ids()));
create policy tax_rates_write on public.tax_rates for all
  using (company_id in (select public.user_company_ids()) and public.has_permission('settings.manage'))
  with check (company_id in (select public.user_company_ids()) and public.has_permission('settings.manage'));

-- Seed: ITBIS 18% (default) y Exento 0% para cada compañía ya existente.
insert into public.tax_rates (company_id, name, rate, is_default, is_active)
select id, 'ITBIS 18%', 18, true, true from public.companies
on conflict do nothing;

insert into public.tax_rates (company_id, name, rate, is_default, is_active)
select id, 'Exento 0%', 0, false, true from public.companies
on conflict do nothing;
