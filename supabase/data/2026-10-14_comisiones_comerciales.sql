-- 14-oct-2026 — Comisiones comerciales (pagos a personas que nos ayudan a
-- conseguir clientes o proyectos). Datos, sin cambios de estructura.
--
-- * Categoría de GASTOS nueva "Comisiones comerciales" (catálogo de gastos,
--   NO el de productos y servicios que vendemos).
-- * 3 tipos de servicio de proveedor en esa categoría, clasificados como
--   COMISION (clasificación fiscal que ya existía). El motor de retenciones
--   usa las reglas que ya hay para COMISION (PF_COMISION, INF_PF_COMISION,
--   "Revisar con su contador"); no se crean ni cambian reglas ni porcentajes.
-- * Idempotente: no duplica si el nombre ya existe (catalog_key).

insert into public.expense_categories (company_id, name, description)
select c.id, 'Comisiones comerciales',
       'Pagos a personas o empresas que nos ayudan a conseguir clientes o proyectos (referidos, intermediación, gestión de ventas). Registrar el gasto en el proyecto para que cuente en su costo.'
from public.companies c
where not exists (
  select 1 from public.expense_categories e
  where e.company_id = c.id and public.catalog_key(e.name) = public.catalog_key('Comisiones comerciales')
);

insert into public.supplier_service_types (company_id, category_id, name, fiscal_classification_id)
select c.id, cat.id, t.name, fc.id
from public.companies c
join public.expense_categories cat
  on cat.company_id = c.id and public.catalog_key(cat.name) = public.catalog_key('Comisiones comerciales')
join public.fiscal_classifications fc
  on fc.code = 'COMISION' and (fc.company_id = c.id or fc.company_id is null)
cross join (values
  ('Comisión por referido / captación de clientes'),
  ('Comisión por intermediación comercial'),
  ('Comisión por gestión de ventas')
) as t(name)
where not exists (
  select 1 from public.supplier_service_types s
  where s.company_id = c.id and public.catalog_key(s.name) = public.catalog_key(t.name)
);
