-- F3: Facturación
-- Ver F0-Arquitectura, sección G "Facturación"

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete restrict,
  project_id uuid references public.projects (id) on delete set null,
  quotation_id uuid references public.quotations (id) on delete set null,
  number text not null,
  issue_date date not null default current_date,
  due_date date,
  status text not null default 'DRAFT' check (
    status in ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED')
  ),
  subtotal numeric(14, 2) not null default 0,
  discount numeric(14, 2) not null default 0,
  tax numeric(14, 2) not null default 0,
  total numeric(14, 2) not null default 0,
  paid_amount numeric(14, 2) not null default 0,
  balance numeric(14, 2) not null default 0,
  ncf text,
  ncf_type text,
  currency text not null default 'DOP',
  exchange_rate numeric(14, 6) not null default 1,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists uq_invoices_company_number on public.invoices (company_id, number);
create index if not exists idx_invoices_client on public.invoices (client_id);
create index if not exists idx_invoices_project on public.invoices (project_id);
create index if not exists idx_invoices_status on public.invoices (status);

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  service_id uuid references public.services (id) on delete set null,
  description text not null,
  quantity numeric(14, 2) not null default 1,
  unit_price numeric(14, 2) not null default 0,
  discount numeric(14, 2) not null default 0,
  tax numeric(14, 2) not null default 0,
  subtotal numeric(14, 2) not null default 0,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_ii_invoice on public.invoice_items (invoice_id);
