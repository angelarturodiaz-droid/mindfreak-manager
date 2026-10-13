-- 082 — Datos bancarios para el pago en facturas y cotizaciones (12-oct).
--
-- 1. bank_accounts.show_on_invoices: la cuenta se ofrece para salir en el
--    recuadro "Datos bancarios" de facturas y cotizaciones. Solo cuentas de
--    banco (nunca tarjetas de crédito).
-- 2. bank_accounts.holder_name: titular si es distinto del nombre legal de la
--    empresa (opcional; vacío = nombre legal de Configuración → Empresa).
-- 3. invoices.bank_details / quotations.bank_details: COPIA congelada de las
--    cuentas elegidas para ese documento (banco, número, tipo, moneda,
--    titular, RNC). Si después se edita la cuenta en Bancos, los documentos
--    ya hechos no cambian. Es informativo: no toca montos, impuestos, cobros
--    ni la lógica fiscal.

alter table public.bank_accounts
  add column if not exists show_on_invoices boolean not null default false,
  add column if not exists holder_name text;

alter table public.bank_accounts
  drop constraint if exists bank_accounts_show_on_invoices_bank_only;
alter table public.bank_accounts
  add constraint bank_accounts_show_on_invoices_bank_only
  check (not show_on_invoices or type = 'BANK');

alter table public.invoices
  add column if not exists bank_details jsonb not null default '[]'::jsonb;
alter table public.quotations
  add column if not exists bank_details jsonb not null default '[]'::jsonb;

alter table public.invoices
  drop constraint if exists invoices_bank_details_is_array;
alter table public.invoices
  add constraint invoices_bank_details_is_array check (jsonb_typeof(bank_details) = 'array');
alter table public.quotations
  drop constraint if exists quotations_bank_details_is_array;
alter table public.quotations
  add constraint quotations_bank_details_is_array check (jsonb_typeof(bank_details) = 'array');

comment on column public.bank_accounts.show_on_invoices is
  'La cuenta se ofrece en "Datos bancarios para el pago" de facturas y cotizaciones (solo BANK).';
comment on column public.bank_accounts.holder_name is
  'Titular a mostrar en facturas si no es el nombre legal de la empresa.';
comment on column public.invoices.bank_details is
  'Copia congelada de las cuentas bancarias que salen en el PDF para el pago.';
comment on column public.quotations.bank_details is
  'Copia congelada de las cuentas bancarias que salen en el PDF para el pago.';
