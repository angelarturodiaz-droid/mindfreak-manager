-- F3: Clientes y Proveedores
-- Ver F0-Arquitectura, sección G "Clientes" / "Proveedores"

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  tax_id text,
  email text,
  phone text,
  address text,
  status text not null default 'LEAD' check (status in ('LEAD', 'ACTIVE')),
  is_active boolean not null default true,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_clients_company on public.clients (company_id);
create index if not exists idx_clients_status on public.clients (status);

create table if not exists public.client_contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  full_name text not null,
  "position" text,
  email text,
  phone text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_client_contacts_client on public.client_contacts (client_id);

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  tax_id text,
  category text,
  email text,
  phone text,
  address text,
  is_active boolean not null default true,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_suppliers_company on public.suppliers (company_id);

create table if not exists public.supplier_contacts (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  full_name text not null,
  "position" text,
  email text,
  phone text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_supplier_contacts_supplier on public.supplier_contacts (supplier_id);
