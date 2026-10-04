-- Datos (no esquema), 2026-10-03: tipos de servicio para las categorías de
-- PROVEEDORES que no tenían ninguno (Seguridad de instalaciones, Honorarios
-- profesionales, Mantenimiento y reparaciones, etc.), cada uno con su
-- clasificación fiscal según la DGII. Propuesta a revisar con el contador;
-- se cambia en Configuración → Tipos de servicio.
--
-- Las categorías administrativas o de movimientos de dinero (Nómina,
-- Impuestos, Caja chica, Préstamos, Transferencia entre cuentas, etc.) se
-- dejan sin tipos: no son servicios de un proveedor.
--
-- Criterio fiscal (igual que la clasificación inicial):
--   técnico = oficio/mano de obra (mantenimiento, limpieza, instalación)
--   profesional = profesión liberal o asesoría (legal, contable, consultoría)
--   alquiler = uso de un bien ajeno · bienes = compra de productos
--   exento = servicios exentos de ITBIS (electricidad, agua, seguros)
--   otro = sin regla específica (telecomunicaciones, medios, licencias)
--
-- Idempotente: no crea un tipo si ya existe uno con el mismo nombre (sin
-- importar mayúsculas ni acentos) en la compañía.

insert into public.supplier_service_types (company_id, category_id, name, fiscal_classification_id)
select c.company_id, c.id, v.tipo, fc.id
from (values
  ('Seguridad de instalaciones', 'Vigilancia de instalaciones', 'SEGURIDAD_VIGILANCIA'),
  ('Seguridad de instalaciones', 'Monitoreo de alarmas', 'SEGURIDAD_VIGILANCIA'),
  ('Seguridad de instalaciones', 'Sistemas contra incendios', 'SERVICIO_TECNICO'),
  ('Seguridad de instalaciones', 'Cámaras de seguridad', 'SERVICIO_TECNICO'),
  ('Honorarios profesionales', 'Asesoría legal', 'SERVICIO_PROFESIONAL'),
  ('Honorarios profesionales', 'Contabilidad y auditoría', 'SERVICIO_PROFESIONAL'),
  ('Honorarios profesionales', 'Asesoría fiscal', 'SERVICIO_PROFESIONAL'),
  ('Honorarios profesionales', 'Consultoría', 'SERVICIO_PROFESIONAL'),
  ('Gastos legales y registrales', 'Servicios notariales', 'SERVICIO_PROFESIONAL'),
  ('Gastos legales y registrales', 'Registro mercantil y trámites', 'SERVICIO_EXENTO'),
  ('Mantenimiento y reparaciones', 'Mantenimiento de aires acondicionados', 'SERVICIO_TECNICO'),
  ('Mantenimiento y reparaciones', 'Reparaciones eléctricas', 'SERVICIO_TECNICO'),
  ('Mantenimiento y reparaciones', 'Plomería', 'SERVICIO_TECNICO'),
  ('Mantenimiento y reparaciones', 'Mantenimiento de vehículos', 'SERVICIO_TECNICO'),
  ('Mantenimiento y reparaciones', 'Reparación de equipos', 'SERVICIO_TECNICO'),
  ('Mantenimiento y reparaciones', 'Pintura y albañilería', 'SERVICIO_TECNICO'),
  ('Limpieza de instalaciones', 'Limpieza de oficina', 'SERVICIO_TECNICO'),
  ('Limpieza de instalaciones', 'Fumigación', 'SERVICIO_TECNICO'),
  ('Servicios de tecnología', 'Soporte técnico informático', 'SERVICIO_TECNICO'),
  ('Servicios de tecnología', 'Redes y cableado', 'SERVICIO_TECNICO'),
  ('Servicios de tecnología', 'Desarrollo de software', 'SERVICIO_PROFESIONAL'),
  ('Software y suscripciones', 'Licencias y suscripciones de software', 'OTRO'),
  ('Software y suscripciones', 'Hosting y dominios', 'OTRO'),
  ('Publicidad y mercadeo', 'Agencia de publicidad', 'SERVICIO_PROFESIONAL'),
  ('Publicidad y mercadeo', 'Publicidad en medios', 'OTRO'),
  ('Publicidad y mercadeo', 'Publicidad digital y redes sociales', 'SERVICIO_PROFESIONAL'),
  ('Capacitación', 'Cursos y talleres', 'SERVICIO_PROFESIONAL'),
  ('Reclutamiento', 'Reclutamiento y selección de personal', 'SERVICIO_PROFESIONAL'),
  ('Importaciones y aduanas', 'Agente aduanal', 'SERVICIO_PROFESIONAL'),
  ('Importaciones y aduanas', 'Flete internacional', 'SERVICIO_TECNICO'),
  ('Alquiler', 'Alquiler de oficina o local', 'ALQUILER'),
  ('Alquiler', 'Alquiler de almacén', 'ALQUILER'),
  ('Alquiler', 'Alquiler de equipos de oficina', 'ALQUILER'),
  ('Servicios públicos', 'Electricidad', 'SERVICIO_EXENTO'),
  ('Servicios públicos', 'Agua potable', 'SERVICIO_EXENTO'),
  ('Servicios públicos', 'Telefonía e internet de oficina', 'OTRO'),
  ('Seguros', 'Pólizas de seguro', 'SERVICIO_EXENTO'),
  ('Materiales de oficina', 'Papelería y útiles de oficina', 'VENTA_BIENES'),
  ('Uniformes', 'Confección de uniformes', 'VENTA_BIENES'),
  ('Compra de activos', 'Mobiliario y equipos', 'VENTA_BIENES'),
  ('Compra de activos', 'Equipos de cómputo', 'VENTA_BIENES'),
  ('Compras de inventario', 'Mercancía para inventario', 'VENTA_BIENES'),
  ('Gastos de representación', 'Comidas y atenciones a clientes', 'VENTA_BIENES'),
  ('Membresías y afiliaciones', 'Cuotas de asociaciones', 'OTRO')
) as v(categoria, tipo, clasificacion)
join public.expense_categories c on public.catalog_key(c.name) = public.catalog_key(v.categoria)
join public.fiscal_classifications fc on fc.company_id = c.company_id and fc.code = v.clasificacion
where not exists (
  select 1 from public.supplier_service_types t
  where t.company_id = c.company_id and public.catalog_key(t.name) = public.catalog_key(v.tipo)
);

-- Verificación: cuántos tipos tiene ahora cada una de estas categorías.
select c.name as categoria, count(t.id) as tipos
from public.expense_categories c
left join public.supplier_service_types t on t.category_id = c.id
where c.name in ('Seguridad de instalaciones', 'Honorarios profesionales', 'Gastos legales y registrales',
  'Mantenimiento y reparaciones', 'Limpieza de instalaciones', 'Servicios de tecnología', 'Software y suscripciones',
  'Publicidad y mercadeo', 'Capacitación', 'Reclutamiento', 'Importaciones y aduanas', 'Alquiler', 'Servicios públicos',
  'Seguros', 'Materiales de oficina', 'Uniformes', 'Compra de activos', 'Compras de inventario',
  'Gastos de representación', 'Membresías y afiliaciones')
group by c.name
order by c.name;
