-- F3: Habilitar RLS en todas las tablas de negocio (denegar-todo por defecto).
-- Las políticas específicas por tabla/permiso se escriben en F4 (Seguridad).
-- Sin políticas, RLS habilitado = ninguna fila visible/editable para roles
-- anon/authenticated; el rol service_role sigue teniendo acceso total (bypassa RLS),
-- que es lo que usan las Server Actions de confianza en el backend.
-- Ver F0-Arquitectura, sección L.

do $$
declare
  t text;
  tables text[] := array[
    'companies', 'profiles', 'roles', 'permissions', 'role_permissions', 'user_roles',
    'clients', 'client_contacts', 'suppliers', 'supplier_contacts',
    'service_categories', 'services',
    'bank_accounts', 'exchange_rates',
    'quotations', 'quotation_items', 'projects', 'project_items',
    'invoices', 'invoice_items',
    'customer_payments', 'expense_categories', 'expenses', 'supplier_payments',
    'bank_transactions', 'documents',
    'tasks', 'activities', 'approvals', 'audit_logs', 'notifications', 'settings',
    'import_batches'
  ];
begin
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security;', t);
  end loop;
end $$;
