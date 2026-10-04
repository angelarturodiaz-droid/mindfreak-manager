-- 073: Tratamiento fiscal — fase 3: reglas fiscales (ver
-- claude/propuesta-tratamiento-fiscal.md).
--
-- Cada fila es una regla = condiciones (vacío = "cualquiera") + una acción.
-- Versionado: varias filas con el mismo rule_key y distinta version /
-- vigencia (valid_from / valid_to). Si DGII cambia una tasa, se crea una
-- nueva versión; la anterior se cierra y los gastos ya registrados conservan
-- su resultado (snapshot en la fase 5).
--
-- Las reglas iniciales son una PROPUESTA basada en fuentes públicas,
-- marcadas needs_review = true ("Revisar con su contador"). No cambia datos
-- existentes. Idempotente.

create table if not exists public.fiscal_rules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  rule_key text not null check (rule_key ~ '^[A-Z0-9_]{2,60}$'),
  version integer not null default 1 check (version >= 1),
  name text not null check (length(btrim(name)) between 3 and 120),
  description text,
  priority integer not null default 100 check (priority between 1 and 999),
  is_active boolean not null default true,
  valid_from date not null,
  valid_to date,
  -- Condiciones (null o vacío = cualquiera)
  supplier_kinds text[],
  fiscal_conditions text[],
  tax_residence text check (tax_residence in ('DO', 'EXTRANJERO')),
  country_code text check (country_code ~ '^[A-Z]{2}$'),
  operation_type text check (operation_type in ('COMPRA_LOCAL', 'PAGO_EXTERIOR')),
  fiscal_classification_id uuid references public.fiscal_classifications (id) on delete restrict,
  document_types text[],
  e_issuer text check (e_issuer in ('SI', 'NO', 'NO_CONFIRMADO')),
  -- Acción
  action text not null check (action in ('RETAIN', 'NO_RETENTION', 'REVIEW', 'BLOCK')),
  isr_rate numeric(5, 2) not null default 0 check (isr_rate between 0 and 100),
  isr_base_pct numeric(5, 2) not null default 100 check (isr_base_pct between 0 and 100),
  itbis_retention_pct numeric(5, 2) not null default 0 check (itbis_retention_pct between 0 and 100),
  tax_rate_id uuid references public.tax_rates (id) on delete set null,
  required_document_type text,
  report_tags text[] not null default '{}',
  user_message text,
  -- Referencia normativa
  legal_source text,
  legal_article text,
  reference_url text,
  notes text,
  needs_review boolean not null default true,
  last_reviewed_at timestamptz,
  reviewed_by uuid references public.profiles (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fiscal_rules_validity check (valid_to is null or valid_to >= valid_from)
);

create unique index if not exists uq_fiscal_rules_version on public.fiscal_rules (company_id, rule_key, version);
create index if not exists idx_fiscal_rules_lookup on public.fiscal_rules (company_id, is_active, valid_from);

drop trigger if exists set_updated_at on public.fiscal_rules;
create trigger set_updated_at before update on public.fiscal_rules
  for each row execute function public.set_updated_at();

alter table public.fiscal_rules enable row level security;

-- Todos los de la compañía las leen (el motor corre con el usuario que
-- registra el gasto); solo Configuración las cambia.
drop policy if exists fiscal_rules_select on public.fiscal_rules;
create policy fiscal_rules_select on public.fiscal_rules for select
  using (company_id in (select public.user_company_ids()));
drop policy if exists fiscal_rules_insert on public.fiscal_rules;
create policy fiscal_rules_insert on public.fiscal_rules for insert
  with check (company_id in (select public.user_company_ids()) and public.has_permission('settings.manage'));
drop policy if exists fiscal_rules_update on public.fiscal_rules;
create policy fiscal_rules_update on public.fiscal_rules for update
  using (company_id in (select public.user_company_ids()) and public.has_permission('settings.manage'))
  with check (company_id in (select public.user_company_ids()) and public.has_permission('settings.manage'));
drop policy if exists fiscal_rules_delete on public.fiscal_rules;
create policy fiscal_rules_delete on public.fiscal_rules for delete
  using (company_id in (select public.user_company_ids()) and public.has_permission('settings.manage'));

-- ───────────── Reglas iniciales (propuesta, revisar con contador) ─────────────
with refs as (
  select
    'https://dgii.gov.do/publicacionesOficiales/avisosInformativos/Documents/2026/10-26.pdf'::text as u_3026,
    'https://dgii.gov.do/legislacion/normasGenerales/Documents/NG%20sobre%20(ITBIS),%20NG%20sobre%20(ISR),%20NG%20sobre%20Comprobantes%20Fiscales/norma07-07.pdf'::text as u_0707,
    'https://dgii.gov.do/legislacion/normasGenerales/Documents/NG%20sobre%20Impuesto%20sobre%20Transferencias%20de%20Bienes%20Industrializados%20y%20Servicios%20(ITBIS)/norma02-05.pdf'::text as u_0205,
    'https://ayuda.dgii.gov.do/conversations/discusiones/consulta-sobre-la-vigencia-de-la-retencin-del-2-para-servicios-tcnicos-luego-de-la-ley-nm-3026/6a553e4824898d6239375893'::text as u_tec
),
seed (rule_key, version, name, description, priority, is_active, valid_from, valid_to,
      supplier_kinds, fiscal_conditions, tax_residence, class_code, document_types, e_issuer,
      action, isr_rate, isr_base_pct, itbis_retention_pct, report_tags, user_message,
      legal_source, legal_article, url_key, notes) as (
  values
  ('PF_SERV_PROFESIONAL', 1, 'Persona Física – Servicios profesionales', 'Honorarios a personas físicas registradas.', 50, true, date '2000-01-01', date '2026-06-30',
   array['PERSONA_FISICA','UNICO_DUENO'], array['REGISTRADO'], 'DO', 'SERVICIO_PROFESIONAL', null::text[], null,
   'RETAIN', 10, 100, 100, array['606','IR-17','IT-1'], null,
   'Código Tributario art. 309 · Norma General 07-2007', 'Art. 309 CT (antes de la Ley 30-26)', 'u_0707', 'Versión anterior a la Ley 30-26.'),
  ('PF_SERV_PROFESIONAL', 2, 'Persona Física – Servicios profesionales', 'Honorarios a personas físicas registradas.', 50, true, date '2026-07-01', null,
   array['PERSONA_FISICA','UNICO_DUENO'], array['REGISTRADO'], 'DO', 'SERVICIO_PROFESIONAL', null, null,
   'RETAIN', 15, 100, 100, array['606','IR-17','IT-1'], null,
   'Ley 30-26 · Norma General 07-2007', 'Art. 309 CT modificado por art. 17 Ley 30-26; ITBIS 100 % NG 07-2007', 'u_3026', 'Tasa ISR 15 % según fuentes secundarias; confirmar con contador.'),
  ('PF_SERV_TECNICO', 1, 'Persona Física – Servicios técnicos', 'Oficios y servicios técnicos de personas físicas.', 50, true, date '2000-01-01', date '2026-06-30',
   array['PERSONA_FISICA','UNICO_DUENO'], array['REGISTRADO'], 'DO', 'SERVICIO_TECNICO', null, null,
   'RETAIN', 2, 100, 100, array['606','IR-17','IT-1'], null,
   'Reglamento 139-98 art. 70 · Norma General 07-2007', 'Art. 70 Reg. 139-98', 'u_0707', 'Versión anterior a la Ley 30-26.'),
  ('PF_SERV_TECNICO', 2, 'Persona Física – Servicios técnicos', 'Oficios y servicios técnicos de personas físicas.', 50, true, date '2026-07-01', null,
   array['PERSONA_FISICA','UNICO_DUENO'], array['REGISTRADO'], 'DO', 'SERVICIO_TECNICO', null, null,
   'RETAIN', 15, 20, 100, array['606','IR-17','IT-1'], null,
   'Ley 30-26 (respuesta DGII) · Norma General 07-2007', '15 % sobre renta neta presunta del 20 % (= 3 % efectivo)', 'u_tec', 'Según respuesta de la DGII en su portal de ayuda.'),
  ('PF_ALQUILER', 1, 'Persona Física – Alquileres', 'Alquiler de bienes a personas físicas.', 50, true, date '2000-01-01', date '2026-06-30',
   array['PERSONA_FISICA','UNICO_DUENO'], array['REGISTRADO'], 'DO', 'ALQUILER', null, null,
   'RETAIN', 10, 100, 100, array['606','IR-17','IT-1'], null,
   'Código Tributario art. 309 · Norma General 07-2007', 'Art. 309 CT', 'u_0707', 'Versión anterior a la Ley 30-26.'),
  ('PF_ALQUILER', 2, 'Persona Física – Alquileres', 'Alquiler de bienes a personas físicas.', 50, true, date '2026-07-01', null,
   array['PERSONA_FISICA','UNICO_DUENO'], array['REGISTRADO'], 'DO', 'ALQUILER', null, null,
   'RETAIN', 15, 100, 100, array['606','IR-17','IT-1'], null,
   'Ley 30-26 · Norma General 07-2007', 'Art. 309 CT mod. Ley 30-26 (pago definitivo)', 'u_3026', 'Confirmar con contador.'),
  ('PF_COMISION', 1, 'Persona Física – Comisiones', 'Comisiones pagadas a personas físicas.', 50, true, date '2000-01-01', date '2026-06-30',
   array['PERSONA_FISICA','UNICO_DUENO'], array['REGISTRADO'], 'DO', 'COMISION', null, null,
   'RETAIN', 10, 100, 100, array['606','IR-17','IT-1'], null,
   'Código Tributario art. 309 · Norma General 07-2007', 'Art. 309 CT', 'u_0707', 'Versión anterior a la Ley 30-26.'),
  ('PF_COMISION', 2, 'Persona Física – Comisiones', 'Comisiones pagadas a personas físicas.', 50, true, date '2026-07-01', null,
   array['PERSONA_FISICA','UNICO_DUENO'], array['REGISTRADO'], 'DO', 'COMISION', null, null,
   'RETAIN', 15, 100, 100, array['606','IR-17','IT-1'], null,
   'Ley 30-26 · Norma General 07-2007', 'Art. 309 CT mod. Ley 30-26', 'u_3026', 'Confirmar con contador.'),
  ('VENTA_BIENES', 1, 'Compra de bienes a proveedor registrado', 'La compra de productos a un proveedor registrado no lleva retención.', 60, true, date '2000-01-01', null,
   null, array['REGISTRADO'], 'DO', 'VENTA_BIENES', null, null,
   'NO_RETENTION', 0, 100, 0, array['606'], null,
   null, null, null, null),
  ('SERVICIO_EXENTO', 1, 'Servicio exento', 'Servicios exentos: no se retiene.', 20, true, date '2000-01-01', null,
   null, null, null, 'SERVICIO_EXENTO', null, null,
   'NO_RETENTION', 0, 100, 0, array['606'], null,
   null, null, null, null),
  ('PJ_SERV_PROFESIONAL', 1, 'Empresa – Servicios profesionales', 'Servicios profesionales entre personas jurídicas: 30 % del ITBIS.', 50, true, date '2005-01-01', null,
   array['PERSONA_JURIDICA'], array['REGISTRADO'], 'DO', 'SERVICIO_PROFESIONAL', null, null,
   'RETAIN', 0, 100, 30, array['606','IT-1'], null,
   'Norma General 02-05', 'Retención 30 % ITBIS', 'u_0205', null),
  ('PJ_SERV_PROFESIONAL_ECF', 1, 'Empresa emisora e-CF – Servicios profesionales', 'Si el proveedor es emisor electrónico y factura con e-CF, deja de aplicar la retención del 30 %.', 10, false, date '2026-09-16', null,
   array['PERSONA_JURIDICA'], array['REGISTRADO'], 'DO', 'SERVICIO_PROFESIONAL', array['E31'], 'SI',
   'NO_RETENTION', 0, 100, 0, array['606'], null,
   'Norma General 02-2026', 'No aplicación de retenciones NG 02-05 a emisores electrónicos', null,
   'INACTIVA: en el portal de la DGII aparece como borrador en consulta pública. Confirmar con contador la versión final y la fecha de vigencia antes de activarla.'),
  ('PJ_ALQUILER', 1, 'Empresa – Alquileres', 'Alquiler entre empresas: si es de equipos se retiene el 30 % del ITBIS (NG 02-05); si es de local u otro inmueble, consultar.', 50, true, date '2005-01-01', null,
   array['PERSONA_JURIDICA'], array['REGISTRADO'], 'DO', 'ALQUILER', null, null,
   'REVIEW', 0, 100, 0, array['606'], 'Alquiler entre empresas: confirma si es de equipos (se retiene 30 % del ITBIS) o de un local.',
   'Norma General 02-05', 'Alquiler de equipos', 'u_0205', 'Requiere revisión porque la clasificación Alquiler incluye equipos y locales.'),
  ('PJ_SEGURIDAD', 1, 'Empresa – Seguridad y vigilancia', 'Servicios de seguridad y vigilancia: 100 % del ITBIS.', 50, true, date '2005-01-01', null,
   array['PERSONA_JURIDICA'], array['REGISTRADO'], 'DO', 'SEGURIDAD_VIGILANCIA', null, null,
   'RETAIN', 0, 100, 100, array['606','IT-1'], null,
   'Norma General 02-05', 'Retención 100 % ITBIS en seguridad y vigilancia', 'u_0205', 'Hay fuentes que indican que la NG 02-2026 también lo exime para emisores e-CF: confirmar.'),
  ('PJ_REGISTRADA_RESTO', 1, 'Empresa registrada – otras operaciones', 'Persona jurídica registrada: no corresponde retención salvo que aplique una regla especial.', 90, true, date '2000-01-01', null,
   array['PERSONA_JURIDICA'], array['REGISTRADO'], 'DO', null, null, null,
   'NO_RETENTION', 0, 100, 0, array['606'], 'No corresponde retención para esta operación según la regla vigente.',
   null, null, null, 'Regla general de menor prioridad.'),
  ('PROVEEDOR_INFORMAL', 1, 'Proveedor informal', 'Proveedores no registrados: requiere comprobante de compras (B11/E41) y revisión de retenciones.', 30, true, date '2000-01-01', null,
   null, array['INFORMAL'], 'DO', null, null, null,
   'REVIEW', 0, 100, 0, array['606'], 'Proveedor informal: emite comprobante de compras (B11/E41) y confirma las retenciones con tu contador.',
   'Norma General 08-2010', 'Proveedores informales', null, null),
  ('RST', 1, 'Proveedor RST', 'Régimen Simplificado de Tributación: requiere revisión.', 30, true, date '2000-01-01', null,
   null, array['RST'], 'DO', null, null, null,
   'REVIEW', 0, 100, 0, array['606'], 'Proveedor del RST: confirma con tu contador si corresponde retención.',
   null, null, null, null),
  ('PAGO_EXTERIOR', 1, 'Pago a proveedor del extranjero', 'Pagos al exterior: retenciones especiales (ISR, convenios, ITBIS de servicios del exterior).', 30, true, date '2000-01-01', null,
   null, null, 'EXTRANJERO', null, null, null,
   'REVIEW', 0, 100, 0, array['609'], 'Pago al exterior: tiene retenciones especiales. Confírmalas con tu contador antes de pagar.',
   'Ley 30-26 (pagos al exterior)', 'Art. 305 CT y siguientes', 'u_3026', null),
  ('SIN_TRATAMIENTO', 1, 'Sin tratamiento automático', 'Servicios marcados para revisión manual.', 5, true, date '2000-01-01', null,
   null, null, null, 'SIN_TRATAMIENTO', null, null,
   'REVIEW', 0, 100, 0, '{}', 'Este tipo de servicio está marcado para revisión manual.',
   null, null, null, null)
)
insert into public.fiscal_rules (
  company_id, rule_key, version, name, description, priority, is_active, valid_from, valid_to,
  supplier_kinds, fiscal_conditions, tax_residence, fiscal_classification_id, document_types, e_issuer,
  action, isr_rate, isr_base_pct, itbis_retention_pct, report_tags, user_message,
  legal_source, legal_article, reference_url, notes, needs_review
)
select c.id, s.rule_key, s.version, s.name, s.description, s.priority, s.is_active, s.valid_from, s.valid_to,
       s.supplier_kinds, s.fiscal_conditions, s.tax_residence, fc.id, s.document_types, s.e_issuer,
       s.action, s.isr_rate, s.isr_base_pct, s.itbis_retention_pct, s.report_tags, s.user_message,
       s.legal_source, s.legal_article,
       case s.url_key when 'u_3026' then r.u_3026 when 'u_0707' then r.u_0707 when 'u_0205' then r.u_0205 when 'u_tec' then r.u_tec end,
       s.notes, true
from public.companies c
cross join seed s
cross join refs r
left join public.fiscal_classifications fc on fc.company_id = c.id and fc.code = s.class_code
on conflict (company_id, rule_key, version) do nothing;
