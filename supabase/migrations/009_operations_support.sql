-- F3: Operaciones, Aprobaciones, Auditoría, Notificaciones, Configuración, Importaciones
-- Ver F0-Arquitectura, sección G "Operaciones" / "Aprobaciones" / "Auditoría" / "Notificaciones" / "Configuración" / "Utilidades"

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  assigned_to uuid references public.profiles (id) on delete set null,
  title text not null,
  description text,
  due_date date,
  status text not null default 'PENDING' check (status in ('PENDING', 'IN_PROGRESS', 'DONE', 'CANCELLED')),
  priority text not null default 'MEDIUM' check (priority in ('LOW', 'MEDIUM', 'HIGH')),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_tasks_project on public.tasks (project_id);
create index if not exists idx_tasks_assigned on public.tasks (assigned_to);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  entity_type text,
  entity_id uuid,
  type text not null check (type in ('CALL', 'MEETING', 'EMAIL', 'NOTE', 'OTHER')),
  description text,
  activity_date timestamptz not null default now(),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_activities_project on public.activities (project_id);

create table if not exists public.approvals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  requested_by uuid references public.profiles (id),
  approver_id uuid references public.profiles (id),
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  comments text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_approvals_entity on public.approvals (entity_type, entity_id);

-- Auditoría: inmutable, sin updated_at (no se edita un registro de auditoría)
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid not null,
  old_values jsonb,
  new_values jsonb,
  ip_address text,
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_entity on public.audit_logs (entity_type, entity_id);
create index if not exists idx_audit_created on public.audit_logs (created_at);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  message text,
  entity_type text,
  entity_id uuid,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_notifications_user on public.notifications (user_id);

create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  key text not null,
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists uq_settings_company_key on public.settings (company_id, key);

create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  entity_type text not null check (entity_type in ('clients', 'suppliers', 'services')),
  file_name text not null,
  total_rows int not null default 0,
  success_count int not null default 0,
  error_count int not null default 0,
  error_details jsonb,
  status text not null default 'PROCESSING' check (
    status in ('PROCESSING', 'COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED')
  ),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_import_batches_entity on public.import_batches (entity_type);
