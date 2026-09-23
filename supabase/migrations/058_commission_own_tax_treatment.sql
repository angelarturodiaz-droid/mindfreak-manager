-- Reconstruida desde producción (supabase_migrations.schema_migrations,
-- versión 20260923041141 "commission_own_tax_treatment", commit eac5fba).
-- Se aplicó directo en Supabase el 2026-09-23 sin comitear el archivo.
-- Reescrita de forma idempotente: en producción (donde ya se aplicó) no
-- cambia nada; en una base nueva deja el esquema igual que producción.
--
-- La comisión de agencia deja de "heredar" un ITBIS diluido según la
-- mezcla de líneas Gravadas/Exentas de la factura/cotización (tasa
-- efectiva promedio) y pasa a tener su PROPIO tratamiento fiscal
-- (Gravada/Exenta/No sujeta), elegido del mismo catálogo de
-- Configuración > Impuestos, igual que cualquier línea. El ITBIS de la
-- comisión se calcula únicamente sobre el monto de la comisión, nunca
-- sobre el subtotal completo ni prorrateado por el resto del documento.
--
-- Backfill de documentos existentes con comisión > 0: se asume Gravada al
-- 18% (aproxima el comportamiento anterior). Solo corre si las columnas se
-- acaban de crear, para no sobrescribir lo que ya eligió el usuario en
-- producción. No afecta el `tax`/`total` ya guardados.

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'invoices' and column_name = 'commission_tax_treatment'
  ) then
    alter table public.invoices
      add column commission_tax_rate_id uuid references public.tax_rates(id) on delete set null,
      add column commission_tax_treatment text not null default 'GRAVADO',
      add column commission_tax_rate_percent numeric not null default 0;

    update public.invoices
    set commission_tax_treatment = 'GRAVADO', commission_tax_rate_percent = 18
    where commission_percent > 0;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'quotations' and column_name = 'commission_tax_treatment'
  ) then
    alter table public.quotations
      add column commission_tax_rate_id uuid references public.tax_rates(id) on delete set null,
      add column commission_tax_treatment text not null default 'GRAVADO',
      add column commission_tax_rate_percent numeric not null default 0;

    update public.quotations
    set commission_tax_treatment = 'GRAVADO', commission_tax_rate_percent = 18
    where commission_percent > 0;
  end if;
end $$;

alter table public.invoices drop constraint if exists invoices_commission_tax_treatment_check;
alter table public.invoices
  add constraint invoices_commission_tax_treatment_check
  check (commission_tax_treatment = any (array['GRAVADO'::text, 'EXENTO'::text, 'NO_SUJETO'::text]));

alter table public.quotations drop constraint if exists quotations_commission_tax_treatment_check;
alter table public.quotations
  add constraint quotations_commission_tax_treatment_check
  check (commission_tax_treatment = any (array['GRAVADO'::text, 'EXENTO'::text, 'NO_SUJETO'::text]));
