-- Facturación Electrónica (e-CF) — DGII República Dominicana. El usuario
-- aún no está certificado por la DGII (proceso en curso a nivel país), así
-- que esto deja PREPARADA la arquitectura: el tipo de factura, y los
-- campos que exige un e-CF real. Los valores que solo puede emitir la
-- DGII (o un proveedor certificado) — e-NCF, código de seguridad, QR — se
-- dejan en blanco hasta que exista una integración real. Nunca se generan
-- valores falsos con ese formato: mostrar un e-NCF o QR que parezca real
-- sin serlo es un problema legal, no solo técnico.

alter table public.invoices
  add column if not exists billing_type text not null default 'REGULAR'
    check (billing_type in ('REGULAR', 'ELECTRONIC')),
  add column if not exists e_ncf text,
  add column if not exists e_ncf_valid_until date,
  add column if not exists payment_type_code text check (payment_type_code in ('1', '2')), -- 1=Contado, 2=Crédito (catálogo DGII)
  add column if not exists security_code text,
  add column if not exists digital_signature_at timestamptz;

comment on column public.invoices.billing_type is
  'REGULAR = factura tradicional (NCF). ELECTRONIC = e-CF DGII — requiere certificación DGII real antes de poder emitir válidamente.';
comment on column public.invoices.e_ncf is
  'Número de Comprobante Fiscal Electrónico — SOLO lo puede emitir la DGII o un proveedor certificado. Nunca generar manualmente.';
comment on column public.invoices.security_code is
  'Código de seguridad del e-CF — lo genera la DGII al certificar el comprobante. Nunca generar manualmente.';
