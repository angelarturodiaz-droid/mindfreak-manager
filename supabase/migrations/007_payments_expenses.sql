-- F3: Cobros, Gastos, Pagos a Proveedores, Movimientos Bancarios
-- Ver F0-Arquitectura, sección G "Cobros" / "Gastos" / "Pagos a Proveedores" / "Bancos"
-- document_id se agrega SIN fk aquí; la FK real se agrega en 008 tras crear "documents"

create table if not exists public.customer_payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete restrict,
  invoice_id uuid not null references public.invoices (id) on delete restrict,
  project_id uuid references public.projects (id) on delete set null,
  bank_account_id uuid references public.bank_accounts (id) on delete set null,
  document_id uuid, -- FK agregada en 008_documents.sql
  payment_date date not null default current_date,
  amount numeric(14, 2) not null,
  method text not null check (method in ('TRANSFER', 'DEPOSIT', 'CHECK', 'CARD', 'CASH', 'OTHER')),
  reference text,
  currency text not null default 'DOP',
  exchange_rate numeric(14, 6) not null default 1,
  notes text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_cp_invoice on public.customer_payments (invoice_id);
create index if not exists idx_cp_project on public.customer_payments (project_id);

create table if not exists public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  category_id uuid references public.expense_categories (id) on delete set null,
  supplier_id uuid references public.suppliers (id) on delete set null,
  project_id uuid references public.projects (id) on delete set null,
  bank_account_id uuid references public.bank_accounts (id) on delete set null,
  document_id uuid, -- FK agregada en 008_documents.sql
  expense_date date not null default current_date,
  description text not null,
  subtotal numeric(14, 2) not null default 0,
  tax numeric(14, 2) not null default 0,
  total numeric(14, 2) not null default 0,
  paid_amount numeric(14, 2) not null default 0,
  balance numeric(14, 2) not null default 0,
  payment_method text check (payment_method in ('TRANSFER', 'DEPOSIT', 'CHECK', 'CARD', 'CASH', 'OTHER')),
  status text not null default 'PENDING' check (status in ('PENDING', 'PARTIALLY_PAID', 'PAID', 'CANCELLED')),
  currency text not null default 'DOP',
  exchange_rate numeric(14, 6) not null default 1,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_expenses_project on public.expenses (project_id);
create index if not exists idx_expenses_supplier on public.expenses (supplier_id);

create table if not exists public.supplier_payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  supplier_id uuid not null references public.suppliers (id) on delete restrict,
  expense_id uuid references public.expenses (id) on delete set null,
  project_id uuid references public.projects (id) on delete set null,
  bank_account_id uuid references public.bank_accounts (id) on delete set null,
  document_id uuid, -- FK agregada en 008_documents.sql
  payment_date date not null default current_date,
  amount numeric(14, 2) not null,
  method text not null check (method in ('TRANSFER', 'DEPOSIT', 'CHECK', 'CARD', 'CASH', 'OTHER')),
  reference text,
  currency text not null default 'DOP',
  exchange_rate numeric(14, 6) not null default 1,
  notes text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_sp_supplier on public.supplier_payments (supplier_id);
create index if not exists idx_sp_expense on public.supplier_payments (expense_id);

create table if not exists public.bank_transactions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  bank_account_id uuid not null references public.bank_accounts (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  client_id uuid references public.clients (id) on delete set null,
  supplier_id uuid references public.suppliers (id) on delete set null,
  customer_payment_id uuid references public.customer_payments (id) on delete set null,
  expense_id uuid references public.expenses (id) on delete set null,
  supplier_payment_id uuid references public.supplier_payments (id) on delete set null,
  type text not null check (type in ('INCOME', 'EXPENSE', 'TRANSFER')),
  amount numeric(14, 2) not null,
  currency text not null default 'DOP',
  exchange_rate numeric(14, 6) not null default 1,
  transaction_date date not null default current_date,
  description text,
  reconciled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_bt_account on public.bank_transactions (bank_account_id);
create index if not exists idx_bt_project on public.bank_transactions (project_id);
