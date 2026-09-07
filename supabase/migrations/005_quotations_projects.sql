-- F3: Cotizaciones y Proyectos/Eventos
-- Ver F0-Arquitectura, sección G "Cotizaciones" / "Proyectos / Eventos"
-- NOTA: quotations.project_id y projects.quotation_id se referencian mutuamente.
-- Se crea quotations.project_id SIN fk primero, se crea projects, y al final
-- se agrega la FK de quotations -> projects (ver bloque final de este archivo).

create table if not exists public.quotations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete restrict,
  contact_id uuid references public.client_contacts (id) on delete set null,
  project_id uuid, -- FK agregada al final de este archivo, tras crear projects
  number text not null,
  issue_date date not null default current_date,
  valid_until date,
  status text not null default 'DRAFT' check (
    status in ('DRAFT', 'SENT', 'VIEWED', 'NEGOTIATING', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED')
  ),
  subtotal numeric(14, 2) not null default 0,
  discount numeric(14, 2) not null default 0,
  tax numeric(14, 2) not null default 0,
  total numeric(14, 2) not null default 0,
  estimated_cost numeric(14, 2) not null default 0,
  estimated_margin numeric(14, 2),
  terms text,
  currency text not null default 'DOP',
  exchange_rate numeric(14, 6) not null default 1,
  created_by uuid references public.profiles (id),
  approved_by uuid references public.profiles (id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists uq_quotations_company_number on public.quotations (company_id, number);
create index if not exists idx_quotations_client on public.quotations (client_id);
create index if not exists idx_quotations_status on public.quotations (status);

create table if not exists public.quotation_items (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations (id) on delete cascade,
  service_id uuid references public.services (id) on delete set null,
  description text not null,
  quantity numeric(14, 2) not null default 1,
  unit_price numeric(14, 2) not null default 0,
  discount numeric(14, 2) not null default 0,
  tax numeric(14, 2) not null default 0,
  subtotal numeric(14, 2) not null default 0,
  estimated_unit_cost numeric(14, 2) not null default 0,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_qi_quotation on public.quotation_items (quotation_id);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete restrict,
  contact_id uuid references public.client_contacts (id) on delete set null,
  quotation_id uuid references public.quotations (id) on delete set null,
  manager_id uuid references public.profiles (id) on delete set null,
  number text not null,
  name text not null,
  event_date date,
  event_time time,
  location_name text,
  address text,
  status text not null default 'PLANNING' check (
    status in ('PLANNING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')
  ),
  budget numeric(14, 2) not null default 0,
  notes text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists uq_projects_company_number on public.projects (company_id, number);
create index if not exists idx_projects_client on public.projects (client_id);
create index if not exists idx_projects_status on public.projects (status);
create index if not exists idx_projects_date on public.projects (event_date);

create table if not exists public.project_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  service_id uuid references public.services (id) on delete set null,
  description text not null,
  quantity numeric(14, 2) not null default 1,
  unit_price numeric(14, 2) not null default 0,
  estimated_cost numeric(14, 2) not null default 0,
  subtotal numeric(14, 2) not null default 0,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_pi_project on public.project_items (project_id);

-- Ahora sí: FK circular de quotations.project_id -> projects.id
alter table public.quotations
  add constraint fk_quotations_project
  foreign key (project_id) references public.projects (id) on delete set null;
