-- F3: Seguridad/Multiempresa (parte 2) — roles, permissions, role_permissions, user_roles
-- Ver F0-Arquitectura, sección G, J, K

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies (id) on delete cascade, -- null = rol de plantilla global
  name text not null,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_roles_company on public.roles (company_id);
-- Nombres únicos entre roles globales (company_id is null)
create unique index if not exists uq_roles_global_name on public.roles (name) where company_id is null;
-- Nombres únicos por compañía para roles personalizados
create unique index if not exists uq_roles_company_name on public.roles (company_id, name) where company_id is not null;

create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  module text not null,
  description text,
  created_at timestamptz not null default now()
);
create unique index if not exists uq_permissions_code on public.permissions (code);

create table if not exists public.role_permissions (
  role_id uuid not null references public.roles (id) on delete cascade,
  permission_id uuid not null references public.permissions (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

create table if not exists public.user_roles (
  user_id uuid not null references public.profiles (id) on delete cascade,
  role_id uuid not null references public.roles (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, role_id, company_id)
);
create index if not exists idx_user_roles_company on public.user_roles (company_id);

-- Función reutilizable para RLS (se usa desde F4 en adelante)
create or replace function public.has_permission(permission_code text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.permissions p on p.id = rp.permission_id
    where ur.user_id = auth.uid()
      and p.code = permission_code
  );
$$;
