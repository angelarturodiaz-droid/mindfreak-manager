-- Reconstruida desde producción (supabase_migrations.schema_migrations,
-- versión 20260923033956 "centralize_tax_treatment", commit 3649dc4).
-- Se aplicó directo en Supabase el 2026-09-23 sin comitear el archivo.
-- Reescrita de forma idempotente: en producción (donde ya se aplicó) no
-- cambia nada; en una base nueva deja el esquema igual que producción.
--
-- Centralizar el tratamiento fiscal (Gravado/Exento/No sujeto) en
-- Settings > Impuestos (tax_rates) como fuente única. Servicios y líneas
-- de documentos ya no guardan un % de impuesto suelto: referencian el
-- catálogo, y las líneas además congelan una copia (snapshot) del
-- tratamiento/tasa usados para preservar el historial.

-- 1) tax_rates: agregar tratamiento fiscal
alter table public.tax_rates
  add column if not exists treatment text not null default 'GRAVADO';

alter table public.tax_rates drop constraint if exists tax_rates_treatment_check;
alter table public.tax_rates
  add constraint tax_rates_treatment_check
  check (treatment = any (array['GRAVADO'::text, 'EXENTO'::text, 'NO_SUJETO'::text]));

-- Heurística de arranque para catálogos ya existentes (el admin puede
-- ajustar el nombre/tratamiento de cada tasa en Settings > Impuestos).
update public.tax_rates
set treatment = 'EXENTO'
where treatment = 'GRAVADO' and name ilike '%exent%';

update public.tax_rates
set treatment = 'NO_SUJETO'
where treatment = 'GRAVADO' and name ilike '%no sujeto%';

-- 2) services: reemplazar el % suelto por una referencia al catálogo
alter table public.services
  add column if not exists default_tax_rate_id uuid references public.tax_rates(id) on delete set null;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'services' and column_name = 'default_tax_percent'
  ) then
    update public.services s
    set default_tax_rate_id = tr.id
    from public.tax_rates tr
    where tr.company_id = s.company_id
      and tr.rate = s.default_tax_percent
      and tr.is_active = true
      and s.default_tax_rate_id is null;

    alter table public.services drop column default_tax_percent;
  end if;
end $$;

-- 3) invoice_items / quotation_items: snapshot histórico del tratamiento
-- y tasa usados en cada línea (independiente de que luego cambie el
-- catálogo o se borre la tasa referenciada).
-- El backfill solo corre si la columna se acaba de crear, para no
-- sobrescribir snapshots ya guardados en producción.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'invoice_items' and column_name = 'tax_treatment'
  ) then
    alter table public.invoice_items
      add column tax_treatment text not null default 'GRAVADO',
      add column tax_rate_percent numeric not null default 0;

    update public.invoice_items ii
    set tax_treatment = tr.treatment, tax_rate_percent = tr.rate
    from public.tax_rates tr
    where ii.tax_rate_id = tr.id;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'quotation_items' and column_name = 'tax_treatment'
  ) then
    alter table public.quotation_items
      add column tax_treatment text not null default 'GRAVADO',
      add column tax_rate_percent numeric not null default 0;

    update public.quotation_items qi
    set tax_treatment = tr.treatment, tax_rate_percent = tr.rate
    from public.tax_rates tr
    where qi.tax_rate_id = tr.id;
  end if;
end $$;

alter table public.invoice_items drop constraint if exists invoice_items_tax_treatment_check;
alter table public.invoice_items
  add constraint invoice_items_tax_treatment_check
  check (tax_treatment = any (array['GRAVADO'::text, 'EXENTO'::text, 'NO_SUJETO'::text]));

alter table public.quotation_items drop constraint if exists quotation_items_tax_treatment_check;
alter table public.quotation_items
  add constraint quotation_items_tax_treatment_check
  check (tax_treatment = any (array['GRAVADO'::text, 'EXENTO'::text, 'NO_SUJETO'::text]));
