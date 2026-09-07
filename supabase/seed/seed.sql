-- F3: Seed — compañía Mindfreak Events, roles base y catálogo de permisos.
-- Idempotente (ON CONFLICT DO NOTHING) para poder re-ejecutarse sin duplicar datos.
-- Ver F0-Arquitectura, secciones H (Seed), J (Roles), K (Permisos).

-- 1) Compañía
insert into public.companies (name, legal_name, platform_name, base_currency, is_active)
values ('Mindfreak Events', 'Mindfreak Events SRL', 'Mindfreak Manager', 'DOP', true)
on conflict do nothing;

-- 2) Roles base (globales: company_id null = plantilla reutilizable)
insert into public.roles (company_id, name, description, is_system) values
  (null, 'ADMIN', 'Acceso total a la plataforma', true),
  (null, 'MANAGER', 'Gestión general y supervisión', true),
  (null, 'SALES', 'Clientes, cotizaciones y seguimiento comercial', true),
  (null, 'FINANCE', 'Facturación, cobros, gastos, pagos y bancos', true),
  (null, 'OPERATIONS', 'Proyectos, eventos, proveedores, tareas y operaciones', true)
on conflict do nothing;

-- 3) Catálogo de permisos (sección 9 del prompt maestro, + clients.convert/import definidos en F0)
insert into public.permissions (code, module, description) values
  ('clients.view', 'clients', 'Ver clientes'),
  ('clients.create', 'clients', 'Crear clientes'),
  ('clients.update', 'clients', 'Editar clientes'),
  ('clients.delete', 'clients', 'Eliminar/desactivar clientes'),
  ('clients.convert', 'clients', 'Convertir cliente potencial (lead) a cliente activo'),
  ('clients.import', 'clients', 'Importar clientes de forma masiva (CSV)'),
  ('suppliers.view', 'suppliers', 'Ver proveedores'),
  ('suppliers.create', 'suppliers', 'Crear proveedores'),
  ('suppliers.update', 'suppliers', 'Editar proveedores'),
  ('suppliers.delete', 'suppliers', 'Eliminar/desactivar proveedores'),
  ('quotations.view', 'quotations', 'Ver cotizaciones'),
  ('quotations.create', 'quotations', 'Crear cotizaciones'),
  ('quotations.update', 'quotations', 'Editar cotizaciones'),
  ('quotations.approve', 'quotations', 'Aprobar/rechazar cotizaciones'),
  ('projects.view', 'projects', 'Ver proyectos/eventos'),
  ('projects.create', 'projects', 'Crear proyectos/eventos'),
  ('projects.update', 'projects', 'Editar proyectos/eventos'),
  ('invoices.view', 'invoices', 'Ver facturas'),
  ('invoices.create', 'invoices', 'Crear facturas'),
  ('payments.view', 'payments', 'Ver cobros'),
  ('payments.create', 'payments', 'Registrar cobros'),
  ('expenses.view', 'expenses', 'Ver gastos'),
  ('expenses.create', 'expenses', 'Crear gastos'),
  ('expenses.approve', 'expenses', 'Aprobar gastos'),
  ('banks.view', 'banks', 'Ver cuentas y movimientos bancarios'),
  ('banks.create', 'banks', 'Registrar movimientos bancarios'),
  ('banks.reconcile', 'banks', 'Conciliar cuentas bancarias'),
  ('reports.view', 'reports', 'Ver reportes'),
  ('users.manage', 'users', 'Gestionar usuarios y sus roles'),
  ('settings.manage', 'settings', 'Gestionar configuración de la empresa')
on conflict do nothing;

-- 4) Asignación de permisos por rol
-- ADMIN: todos los permisos
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.name = 'ADMIN' and r.company_id is null
on conflict do nothing;

-- MANAGER: todo excepto users.manage y settings.manage
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.name = 'MANAGER' and r.company_id is null
  and p.code not in ('users.manage', 'settings.manage')
on conflict do nothing;

-- SALES: clientes + cotizaciones + vista de proyectos/reportes
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.name = 'SALES' and r.company_id is null
  and p.code in (
    'clients.view', 'clients.create', 'clients.update', 'clients.convert', 'clients.import',
    'quotations.view', 'quotations.create', 'quotations.update',
    'projects.view', 'reports.view'
  )
on conflict do nothing;

-- FINANCE: facturación, cobros, gastos, pagos, bancos + vista de clientes/proveedores/cotizaciones/proyectos
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.name = 'FINANCE' and r.company_id is null
  and p.code in (
    'invoices.view', 'invoices.create',
    'payments.view', 'payments.create',
    'expenses.view', 'expenses.create', 'expenses.approve',
    'banks.view', 'banks.create', 'banks.reconcile',
    'clients.view', 'suppliers.view', 'quotations.view', 'projects.view', 'reports.view'
  )
on conflict do nothing;

-- OPERATIONS: proyectos, proveedores + vista de clientes/cotizaciones/reportes
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.name = 'OPERATIONS' and r.company_id is null
  and p.code in (
    'projects.view', 'projects.create', 'projects.update',
    'suppliers.view', 'suppliers.create', 'suppliers.update',
    'clients.view', 'quotations.view', 'reports.view'
  )
on conflict do nothing;
