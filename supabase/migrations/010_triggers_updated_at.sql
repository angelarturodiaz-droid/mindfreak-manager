-- F3: Trigger genérico para mantener updated_at automáticamente
-- Ver F0-Arquitectura, sección H (Triggers)

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
  tables text[] := array[
    'companies', 'profiles', 'roles',
    'clients', 'client_contacts', 'suppliers', 'supplier_contacts',
    'service_categories', 'services',
    'bank_accounts',
    'quotations', 'quotation_items', 'projects', 'project_items',
    'invoices', 'invoice_items',
    'customer_payments', 'expense_categories', 'expenses', 'supplier_payments',
    'bank_transactions', 'documents',
    'tasks', 'activities', 'approvals', 'notifications', 'settings', 'import_batches'
  ];
begin
  foreach t in array tables loop
    execute format(
      'drop trigger if exists set_updated_at on public.%I; ' ||
      'create trigger set_updated_at before update on public.%I ' ||
      'for each row execute function public.set_updated_at();',
      t, t
    );
  end loop;
end $$;
