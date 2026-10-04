-- 072: Tratamiento fiscal — fase 2: perfil fiscal del proveedor (ver
-- claude/propuesta-tratamiento-fiscal.md). Solo agrega columnas opcionales;
-- tax_id (RNC/Cédula) sigue igual. Idempotente.

alter table public.suppliers
  add column if not exists id_type text
    check (id_type in ('RNC', 'CEDULA', 'PASAPORTE', 'EXTRANJERO')),
  add column if not exists supplier_kind text
    check (supplier_kind in ('PERSONA_FISICA', 'PERSONA_JURIDICA', 'UNICO_DUENO', 'OTRO')),
  add column if not exists fiscal_condition text
    check (fiscal_condition in ('REGISTRADO', 'INFORMAL', 'RST', 'OTRO')),
  add column if not exists tax_residence text not null default 'DO'
    check (tax_residence in ('DO', 'EXTRANJERO')),
  add column if not exists country_code text
    check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  add column if not exists foreign_tax_id text,
  add column if not exists e_issuer text not null default 'NO_CONFIRMADO'
    check (e_issuer in ('SI', 'NO', 'NO_CONFIRMADO')),
  add column if not exists fiscal_reviewed_at timestamptz;

comment on column public.suppliers.id_type is 'Tipo de identificación: RNC (9 dígitos), CEDULA (11), PASAPORTE, EXTRANJERO.';
comment on column public.suppliers.supplier_kind is 'Persona física / jurídica / negocio de único dueño / otro (sugerido por el largo del RNC/Cédula, editable).';
comment on column public.suppliers.fiscal_condition is 'Condición ante la DGII: registrado, informal, RST, otro. Nunca se deduce del largo del documento.';
comment on column public.suppliers.e_issuer is 'Emisor electrónico de e-CF: SI / NO / NO_CONFIRMADO.';
