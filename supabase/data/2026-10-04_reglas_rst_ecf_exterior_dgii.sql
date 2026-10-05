-- Reglas fiscales con información pública de la DGII, 4-oct-2026 (todas "por revisar con el contador").
-- 1) Proveedor RST: retención del 100 % del ITBIS cuando el comprador no está en el RST
--    (Decreto 265-19, art. 9 párr. II). ISR 0 hasta confirmar con el contador.
-- 2) NG 02-2026 (emitida 16-sep-2026): entre personas jurídicas emisoras e-CF, con comprobante
--    electrónico, no se aplica la retención del 30 % del ITBIS de la NG 02-05. Se ACTIVA la regla
--    PJ_SERV_PROFESIONAL_ECF que estaba inactiva (era borrador). Fecha de vigencia: confirmar.
-- 5) Pagos al exterior (ISR): 27 % general (art. 305 CT); desde 1-jul-2026 15 % para licencias de
--    software, publicidad digital, regalías y almacenamiento de datos (Ley 30-26). Se crea la
--    clasificación SERVICIO_DIGITAL y se asigna a los tipos de servicio de software/hosting y a dos
--    tipos nuevos. El ITBIS por servicios del exterior NO se modela aquí (requiere cambio del motor).
-- Prioridades: 26 (digital exterior) y 28 (exterior general, RST) ganan sobre las reglas
-- "Revisar" de prioridad 30 y ceden ante "Servicio exento" (20) y "Sin tratamiento" (5).
-- Idempotente.

-- Clasificación nueva
insert into public.fiscal_classifications (company_id, code, name, description, position)
select c.id, 'SERVICIO_DIGITAL', 'Servicio digital / software',
       'Licencias de software, suscripciones, publicidad en plataformas digitales, regalías, hosting y almacenamiento de datos. Si el proveedor es del exterior, la retención de ISR es 15 % desde el 1-jul-2026 (Ley 30-26).',
       75
from public.companies c
where not exists (select 1 from public.fiscal_classifications f where f.company_id = c.id and f.code = 'SERVICIO_DIGITAL');

-- Tipos de servicio existentes que pasan a "Servicio digital"
update public.supplier_service_types st
set fiscal_classification_id = f.id
from public.fiscal_classifications f, public.expense_categories ec
where f.company_id = st.company_id and f.code = 'SERVICIO_DIGITAL'
  and ec.id = st.category_id and ec.name = 'Software y suscripciones'
  and st.name in ('Licencias y suscripciones de software', 'Hosting y dominios');

-- Tipos de servicio nuevos
insert into public.supplier_service_types (company_id, category_id, name, fiscal_classification_id)
select ec.company_id, ec.id, v.name, f.id
from (values ('Software y suscripciones', 'Almacenamiento en la nube'),
             ('Publicidad y mercadeo', 'Publicidad en plataformas digitales (Google, Meta, TikTok)')) as v(cat, name)
join public.expense_categories ec on ec.name = v.cat
join public.fiscal_classifications f on f.company_id = ec.company_id and f.code = 'SERVICIO_DIGITAL'
where not exists (
  select 1 from public.supplier_service_types x
  where x.company_id = ec.company_id and public.catalog_key(x.name) = public.catalog_key(v.name)
);

-- Activar NG 02-2026 (e-CF)
update public.fiscal_rules
set is_active = true,
    legal_source = 'Norma General 02-2026 (emitida 16-sep-2026)',
    notes = 'Activada el 4-oct-2026: la NG 02-2026 fue emitida el 16-sep-2026 (antes estaba en consulta pública). Requiere proveedor emisor e-CF y comprobante E31. Confirmar con contador la fecha de vigencia.',
    needs_review = true
where rule_key = 'PJ_SERV_PROFESIONAL_ECF' and version = 1;

-- Reglas nuevas
with c as (select id as company_id from public.companies),
cls as (select company_id, code, id from public.fiscal_classifications),
src(rule_key, version, name, description, priority, conds, residence, code, valid_from, valid_to,
    isr_rate, itbis_pct, tags, legal_source, legal_article, reference_url, notes) as (
  values
  ('RST_ITBIS', 1, 'Proveedor RST – retención de ITBIS', 'Compras a proveedores del Régimen Simplificado de Tributación: se retiene el 100 % del ITBIS facturado.',
   28, array['RST'], 'DO', null::text, date '2019-07-01', null::date, 0, 100, array['606','IT-1'],
   'Decreto 265-19 (Reglamento RST)', 'Art. 9, párrafo II', 'https://siemprealdia.co/republica-dominicana/impuestos/retenciones-en-el-rst/',
   'ISR en 0 hasta confirmar con el contador si corresponde retención de ISR al proveedor RST.'),
  ('EXT_GENERAL', 1, 'Pago al exterior – ISR general', 'Pagos a personas o empresas del extranjero por servicios: retención de ISR del 27 % (pago único y definitivo).',
   28, null::text[], 'EXTRANJERO', null, date '2000-01-01', null, 27, 0, array['609','IR-17'],
   'Código Tributario art. 305', 'Art. 305 CT', 'https://siemprealdia.co/republica-dominicana/impuestos/formato-609-de-pagos-al-exterior/',
   'El ITBIS por servicios del exterior (18 %) no se calcula todavía. Revisar convenios para evitar doble tributación con el contador.'),
  ('EXT_DIGITAL', 1, 'Pago al exterior – servicios digitales', 'Licencias de software, publicidad digital, regalías y almacenamiento de datos pagados al exterior.',
   26, null, 'EXTRANJERO', 'SERVICIO_DIGITAL', date '2000-01-01', date '2026-06-30', 27, 0, array['609','IR-17'],
   'Código Tributario art. 305', 'Art. 305 CT (antes de la Ley 30-26)', 'https://siemprealdia.co/republica-dominicana/impuestos/formato-609-de-pagos-al-exterior/',
   'Versión anterior a la Ley 30-26. Confirmar con contador.'),
  ('EXT_DIGITAL', 2, 'Pago al exterior – servicios digitales', 'Licencias de software, publicidad digital, regalías y almacenamiento de datos pagados al exterior.',
   26, null, 'EXTRANJERO', 'SERVICIO_DIGITAL', date '2026-07-01', null, 15, 0, array['609','IR-17'],
   'Ley 30-26', 'Art. 305 CT mod. Ley 30-26 (15 %)', 'https://www.hacienda.gob.do/ley-30-26-no-dispone-impuestos-por-suscripciones-de-ciudadanos-a-plataformas-digitales-reduce-de-27-a-15-la-retencion-a-empresas-que-contratan-servicios-tecnologicos-en-el-exterior/',
   'No todo SaaS califica (consultoría, implementación o soporte pueden ir al 27 %). Si la plataforma cobra el total con tarjeta (Google, Meta), la retención la asume la empresa encima del pago: confirmar con contador cómo registrarlo.')
)
insert into public.fiscal_rules (
  company_id, rule_key, version, name, description, priority, is_active, valid_from, valid_to,
  supplier_kinds, fiscal_conditions, tax_residence, fiscal_classification_id,
  action, isr_rate, isr_base_pct, itbis_retention_pct, report_tags,
  legal_source, legal_article, reference_url, notes, needs_review
)
select c.company_id, s.rule_key, s.version, s.name, s.description, s.priority, true, s.valid_from, s.valid_to,
       null, s.conds, s.residence, cls.id,
       'RETAIN', s.isr_rate, 100, s.itbis_pct, s.tags,
       s.legal_source, s.legal_article, s.reference_url, s.notes, true
from src s
cross join c
left join cls on cls.company_id = c.company_id and cls.code = s.code
where (s.code is null or cls.id is not null)
  and not exists (
    select 1 from public.fiscal_rules r
    where r.company_id = c.company_id and r.rule_key = s.rule_key and r.version = s.version
  );
