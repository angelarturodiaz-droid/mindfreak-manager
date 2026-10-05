-- Reglas fiscales para PROVEEDOR INFORMAL persona física (no registrado en la DGII), 4-oct-2026.
-- Pedido del usuario: cargar lo que indica la DGII y dejarlo marcado "por revisar con el contador".
--   · ITBIS: retención del 100 % del ITBIS facturado al comprar bienes o servicios a personas físicas
--     no registradas (Norma General 05-19). Comprobante: B11 (lo emite la empresa).
--   · ISR: mismas tasas que a la persona física registrada (art. 309 CT / Ley 30-26 desde 1-jul-2026):
--     servicios profesionales, alquileres y comisiones 10 % → 15 %; servicios técnicos 2 % → 15 % s/20 %.
--   · Compra de bienes: solo ITBIS 100 %, sin ISR.
-- Prioridad 25: gana sobre "Proveedor informal → Revisar" (30) y cede ante "Servicio exento" (20)
-- y "Sin tratamiento" (5). Clasificaciones no cubiertas (seguridad, otro…) siguen en Revisar.
-- Idempotente: no inserta una regla/versión que ya exista.
with c as (select id as company_id from public.companies),
cls as (select company_id, code, id from public.fiscal_classifications),
src(rule_key, version, name, description, code, valid_from, valid_to, isr_rate, isr_base_pct, legal_source, legal_article, reference_url, notes) as (
  values
  ('INF_PF_SERV_PROFESIONAL', 1, 'Informal persona física – Servicios profesionales', 'Honorarios a personas físicas no registradas (comprobante B11).', 'SERVICIO_PROFESIONAL', date '2000-01-01', date '2026-06-30', 10, 100,
   'Código Tributario art. 309 · Norma General 05-19', 'Art. 309 CT; ITBIS 100 % NG 05-19', 'https://dgii.gov.do/publicacionesOficiales/bibliotecaVirtual/contribuyentes/retencionesRetribucionesComplementarias/Documents/Retenciones-ISR-ITBIS.pdf', 'Versión anterior a la Ley 30-26. Según DGII; confirmar con contador.'),
  ('INF_PF_SERV_PROFESIONAL', 2, 'Informal persona física – Servicios profesionales', 'Honorarios a personas físicas no registradas (comprobante B11).', 'SERVICIO_PROFESIONAL', date '2026-07-01', null, 15, 100,
   'Ley 30-26 · Norma General 05-19', 'Art. 309 CT mod. Ley 30-26; ITBIS 100 % NG 05-19', 'https://dgii.gov.do/publicacionesOficiales/avisosInformativos/Documents/2026/10-26.pdf', 'Según DGII; confirmar con contador.'),
  ('INF_PF_SERV_TECNICO', 1, 'Informal persona física – Servicios técnicos', 'Oficios y servicios técnicos de personas físicas no registradas (comprobante B11).', 'SERVICIO_TECNICO', date '2000-01-01', date '2026-06-30', 2, 100,
   'Reglamento 139-98 art. 70 · Norma General 05-19', 'Art. 70 Reg. 139-98; ITBIS 100 % NG 05-19', 'https://dgii.gov.do/publicacionesOficiales/bibliotecaVirtual/contribuyentes/retencionesRetribucionesComplementarias/Documents/Retenciones-ISR-ITBIS.pdf', 'Versión anterior a la Ley 30-26. Según DGII; confirmar con contador.'),
  ('INF_PF_SERV_TECNICO', 2, 'Informal persona física – Servicios técnicos', 'Oficios y servicios técnicos de personas físicas no registradas (comprobante B11).', 'SERVICIO_TECNICO', date '2026-07-01', null, 15, 20,
   'Ley 30-26 (respuesta DGII) · Norma General 05-19', '15 % sobre renta neta presunta del 20 % (= 3 % efectivo); ITBIS 100 % NG 05-19', 'https://ayuda.dgii.gov.do/conversations/discusiones/consulta-sobre-la-vigencia-de-la-retencin-del-2-para-servicios-tcnicos-luego-de-la-ley-nm-3026/6a553e4824898d6239375893', 'Según DGII; confirmar con contador.'),
  ('INF_PF_ALQUILER', 1, 'Informal persona física – Alquileres', 'Alquiler de bienes a personas físicas no registradas (comprobante B11). El alquiler de vivienda no lleva ITBIS.', 'ALQUILER', date '2000-01-01', date '2026-06-30', 10, 100,
   'Código Tributario art. 309 · Norma General 05-19', 'Art. 309 CT; ITBIS 100 % NG 05-19', 'https://ayuda.dgii.gov.do/conversations/discusiones/tipo-de-comprobante-a-un-proveedor-fisico-que-no-emite-ncf-y-el-tipo-de-servicio-es-alquiler/63cee1c0468ae80d3934559e', 'Versión anterior a la Ley 30-26. Según DGII; confirmar con contador.'),
  ('INF_PF_ALQUILER', 2, 'Informal persona física – Alquileres', 'Alquiler de bienes a personas físicas no registradas (comprobante B11). El alquiler de vivienda no lleva ITBIS.', 'ALQUILER', date '2026-07-01', null, 15, 100,
   'Ley 30-26 · Norma General 05-19', 'Art. 309 CT mod. Ley 30-26 (pago definitivo); ITBIS 100 % NG 05-19', 'https://dgii.gov.do/publicacionesOficiales/avisosInformativos/Documents/2026/10-26.pdf', 'Según DGII; confirmar con contador.'),
  ('INF_PF_COMISION', 1, 'Informal persona física – Comisiones', 'Comisiones a personas físicas no registradas (comprobante B11).', 'COMISION', date '2000-01-01', date '2026-06-30', 10, 100,
   'Código Tributario art. 309 · Norma General 05-19', 'Art. 309 CT; ITBIS 100 % NG 05-19', 'https://dgii.gov.do/publicacionesOficiales/bibliotecaVirtual/contribuyentes/retencionesRetribucionesComplementarias/Documents/Retenciones-ISR-ITBIS.pdf', 'Versión anterior a la Ley 30-26. Según DGII; confirmar con contador.'),
  ('INF_PF_COMISION', 2, 'Informal persona física – Comisiones', 'Comisiones a personas físicas no registradas (comprobante B11).', 'COMISION', date '2026-07-01', null, 15, 100,
   'Ley 30-26 · Norma General 05-19', 'Art. 309 CT mod. Ley 30-26; ITBIS 100 % NG 05-19', 'https://dgii.gov.do/publicacionesOficiales/avisosInformativos/Documents/2026/10-26.pdf', 'Según DGII; confirmar con contador.'),
  ('INF_PF_VENTA_BIENES', 1, 'Informal persona física – Compra de bienes', 'Compra de productos a personas físicas no registradas (comprobante B11): se retiene el ITBIS, sin ISR.', 'VENTA_BIENES', date '2000-01-01', null, 0, 100,
   'Norma General 05-19', 'ITBIS 100 % NG 05-19', 'https://dgii.gov.do/publicacionesOficiales/bibliotecaVirtual/contribuyentes/retencionesRetribucionesComplementarias/Documents/Retenciones-ISR-ITBIS.pdf', 'Según DGII; confirmar con contador.')
)
insert into public.fiscal_rules (
  company_id, rule_key, version, name, description, priority, is_active, valid_from, valid_to,
  supplier_kinds, fiscal_conditions, tax_residence, fiscal_classification_id,
  action, isr_rate, isr_base_pct, itbis_retention_pct, required_document_type, report_tags,
  user_message, legal_source, legal_article, reference_url, notes, needs_review
)
select c.company_id, s.rule_key, s.version, s.name, s.description, 25, true, s.valid_from, s.valid_to,
       array['PERSONA_FISICA','UNICO_DUENO'], array['INFORMAL'], 'DO', cls.id,
       'RETAIN', s.isr_rate, s.isr_base_pct, 100, 'B11', array['606','IR-17','IT-1'],
       null, s.legal_source, s.legal_article, s.reference_url, s.notes, true
from src s
cross join c
join cls on cls.company_id = c.company_id and cls.code = s.code
where not exists (
  select 1 from public.fiscal_rules r
  where r.company_id = c.company_id and r.rule_key = s.rule_key and r.version = s.version
);
