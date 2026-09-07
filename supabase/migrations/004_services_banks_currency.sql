-- F3: Servicios, Bancos, Monedas
-- Ver F0-Arquitectura, sección G "Servicios" / "Bancos" / "Monedas / Tipo de Cambio"

create table if not exists public.service_categories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  category_id uuid references public.service_categories (id) on delete set null,
  name text not null,
  unit text,
  default_price numeric(14, 2) not null default 0,
  default_cost numeric(14, 2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_services_company on public.services (company_id);

-- Bancos (antes de facturación/gastos para evitar dependencias circulares)
create table if not exists public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  bank_name text,
  account_number_masked text,
  currency text not null default 'DOP',
  opening_balance numeric(14, 2) not null default 0,
  opening_balance_date date not null default current_date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_bank_accounts_company on public.bank_accounts (company_id);

-- Tasas de cambio de referencia (el exchange_rate usado se congela en cada transacción)
create table if not exists public.exchange_rates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  currency_code text not null,
  rate_to_base numeric(14, 6) not null,
  effective_date date not null default current_date,
  source text not null default 'manual' check (source in ('manual', 'api')),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create unique index if not exists uq_exchange_rates_company_currency_date
  on public.exchange_rates (company_id, currency_code, effective_date);
