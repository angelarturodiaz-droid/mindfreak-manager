-- 096 — 5c Activos de la empresa (mobiliario, decoración, equipos, suministros).
--
-- Lo que la empresa compró para usar. Cada activo tiene código ACT-0001, tipo, cantidad,
-- responsable, ubicación, valor, estado y fotos (documents, entity_type 'asset').
-- Enlace opcional al gasto con que se compró. Historial propio (asset_events) que se llena
-- solo con un trigger: quién cambió responsable, ubicación, estado, cantidad o valor.
--
-- No cambia gastos, pagos, bancos, reportes ni reglas fiscales: el activo solo LEE el gasto.
-- Permisos nuevos: assets.view (todos los roles) y assets.manage (Administración y Gerente).
-- Idempotente.

-- 1. Permisos ---------------------------------------------------------------

insert into public.permissions (code, module, description) values
  ('assets.view', 'assets', 'Ver los activos de la empresa'),
  ('assets.manage', 'assets', 'Registrar y editar activos (responsable, ubicación, estado, fotos)')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code = 'assets.view'
where r.company_id is null and r.name in ('ADMIN', 'MANAGER', 'FINANCE', 'OPERATIONS', 'SALES')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code = 'assets.manage'
where r.company_id is null and r.name in ('ADMIN', 'MANAGER')
on conflict do nothing;

-- 2. Listas de Configuración --------------------------------------------------

create table if not exists public.asset_types (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  name text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists uq_asset_types_name on public.asset_types(company_id, lower(name));

create table if not exists public.asset_locations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  name text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists uq_asset_locations_name on public.asset_locations(company_id, lower(name));

-- 3. Activos ---------------------------------------------------------------------

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  code text not null,
  type_id uuid references public.asset_types(id) on delete set null,
  description text not null check (length(trim(description)) >= 2),
  detail text,
  quantity numeric(12, 2) not null default 1 check (quantity > 0),
  responsible_name text,
  location_id uuid references public.asset_locations(id) on delete set null,
  value numeric(14, 2) check (value is null or value >= 0),
  currency text not null default 'DOP' check (currency in ('DOP', 'USD')),
  purchase_date date,
  status text not null default 'EN_USO' check (status in ('EN_USO', 'EN_REPARACION', 'DADO_DE_BAJA')),
  is_consumable boolean not null default false,
  expense_id uuid references public.expenses(id) on delete set null,
  cover_document_id uuid references public.documents(id) on delete set null,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists uq_assets_code on public.assets(company_id, code);
create index if not exists idx_assets_company_created on public.assets(company_id, created_at desc);
create index if not exists idx_assets_expense on public.assets(expense_id) where expense_id is not null;

-- 4. Historial (lo llena el trigger; nadie lo escribe a mano) -------------------

create table if not exists public.asset_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  asset_id uuid not null references public.assets(id) on delete cascade,
  field text not null,
  old_value text,
  new_value text,
  changed_by uuid default auth.uid(),
  changed_at timestamptz not null default now()
);
create index if not exists idx_asset_events_asset on public.asset_events(asset_id, changed_at desc);

-- 5. Fotos en documentos ---------------------------------------------------------

alter table public.documents drop constraint if exists documents_entity_type_check;
alter table public.documents add constraint documents_entity_type_check
  check (entity_type in ('quotation', 'invoice', 'expense', 'project', 'supplier', 'client', 'receipt',
                         'contract', 'other', 'delivery_receipt', 'asset'));

-- 6. Código ACT-0001 y validaciones ------------------------------------------------

create or replace function public.assets_before_write()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_next int;
begin
  if tg_op = 'INSERT' then
    if new.code is null or new.code = '' then
      perform pg_advisory_xact_lock(hashtext('asset_code:' || new.company_id::text));
      select coalesce(max(nullif(regexp_replace(code, '\D', '', 'g'), '')::int), 0) + 1
        into v_next
        from public.assets where company_id = new.company_id;
      new.code := 'ACT-' || lpad(v_next::text, 4, '0');
    end if;
  else
    new.code := old.code;               -- el código no cambia
    new.company_id := old.company_id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.updated_at := now();
  end if;

  if new.type_id is not null and not exists (select 1 from public.asset_types t where t.id = new.type_id and t.company_id = new.company_id) then
    raise exception 'invalid_type: el tipo no es de esta compañía';
  end if;
  if new.location_id is not null and not exists (select 1 from public.asset_locations l where l.id = new.location_id and l.company_id = new.company_id) then
    raise exception 'invalid_location: la ubicación no es de esta compañía';
  end if;
  if new.expense_id is not null and not exists (select 1 from public.expenses e where e.id = new.expense_id and e.company_id = new.company_id) then
    raise exception 'invalid_expense: el gasto no es de esta compañía';
  end if;
  if new.cover_document_id is not null and not exists (
    select 1 from public.documents d where d.id = new.cover_document_id and d.entity_type = 'asset' and d.entity_id = new.id
  ) then
    raise exception 'invalid_cover: la portada debe ser una foto de este activo';
  end if;
  new.responsible_name := nullif(trim(coalesce(new.responsible_name, '')), '');
  new.detail := nullif(trim(coalesce(new.detail, '')), '');
  new.description := trim(new.description);
  return new;
end;
$$;

drop trigger if exists trg_assets_before_write on public.assets;
create trigger trg_assets_before_write
  before insert or update on public.assets
  for each row execute function public.assets_before_write();

create or replace function public.assets_log_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_loc text;
  v_new_loc text;
begin
  if tg_op = 'INSERT' then
    insert into public.asset_events (company_id, asset_id, field, new_value)
    values (new.company_id, new.id, 'CREATED', new.code);
    return new;
  end if;
  if new.responsible_name is distinct from old.responsible_name then
    insert into public.asset_events (company_id, asset_id, field, old_value, new_value)
    values (new.company_id, new.id, 'responsible', old.responsible_name, new.responsible_name);
  end if;
  if new.location_id is distinct from old.location_id then
    select name into v_old_loc from public.asset_locations where id = old.location_id;
    select name into v_new_loc from public.asset_locations where id = new.location_id;
    insert into public.asset_events (company_id, asset_id, field, old_value, new_value)
    values (new.company_id, new.id, 'location', v_old_loc, v_new_loc);
  end if;
  if new.status is distinct from old.status then
    insert into public.asset_events (company_id, asset_id, field, old_value, new_value)
    values (new.company_id, new.id, 'status', old.status, new.status);
  end if;
  if new.quantity is distinct from old.quantity then
    insert into public.asset_events (company_id, asset_id, field, old_value, new_value)
    values (new.company_id, new.id, 'quantity', old.quantity::text, new.quantity::text);
  end if;
  if new.value is distinct from old.value or new.currency is distinct from old.currency then
    insert into public.asset_events (company_id, asset_id, field, old_value, new_value)
    values (new.company_id, new.id, 'value',
            case when old.value is null then null else old.currency || ' ' || old.value::text end,
            case when new.value is null then null else new.currency || ' ' || new.value::text end);
  end if;
  return new;
end;
$$;

revoke execute on function public.assets_log_events() from public, anon, authenticated;

drop trigger if exists trg_assets_log_events on public.assets;
create trigger trg_assets_log_events
  after insert or update on public.assets
  for each row execute function public.assets_log_events();

-- 7. RLS ---------------------------------------------------------------------------

alter table public.asset_types enable row level security;
alter table public.asset_locations enable row level security;
alter table public.assets enable row level security;
alter table public.asset_events enable row level security;

drop policy if exists asset_types_select on public.asset_types;
create policy asset_types_select on public.asset_types for select to authenticated
  using (company_id in (select public.user_company_ids()) and public.has_permission('assets.view'));
drop policy if exists asset_types_write on public.asset_types;
create policy asset_types_write on public.asset_types for all to authenticated
  using (company_id in (select public.user_company_ids()) and (public.has_permission('settings.manage') or public.has_permission('assets.manage')))
  with check (company_id in (select public.user_company_ids()) and (public.has_permission('settings.manage') or public.has_permission('assets.manage')));

drop policy if exists asset_locations_select on public.asset_locations;
create policy asset_locations_select on public.asset_locations for select to authenticated
  using (company_id in (select public.user_company_ids()) and public.has_permission('assets.view'));
drop policy if exists asset_locations_write on public.asset_locations;
create policy asset_locations_write on public.asset_locations for all to authenticated
  using (company_id in (select public.user_company_ids()) and (public.has_permission('settings.manage') or public.has_permission('assets.manage')))
  with check (company_id in (select public.user_company_ids()) and (public.has_permission('settings.manage') or public.has_permission('assets.manage')));

drop policy if exists assets_select on public.assets;
create policy assets_select on public.assets for select to authenticated
  using (company_id in (select public.user_company_ids()) and public.has_permission('assets.view'));
drop policy if exists assets_insert on public.assets;
create policy assets_insert on public.assets for insert to authenticated
  with check (company_id in (select public.user_company_ids()) and public.has_permission('assets.manage'));
drop policy if exists assets_update on public.assets;
create policy assets_update on public.assets for update to authenticated
  using (company_id in (select public.user_company_ids()) and public.has_permission('assets.manage'))
  with check (company_id in (select public.user_company_ids()) and public.has_permission('assets.manage'));
-- Sin política de borrado: un activo no se borra, se marca «Dado de baja».

drop policy if exists asset_events_select on public.asset_events;
create policy asset_events_select on public.asset_events for select to authenticated
  using (company_id in (select public.user_company_ids()) and public.has_permission('assets.view'));

-- 8. Listas iniciales (genéricas; el usuario agrega las suyas en Configuración → Activos) ---

insert into public.asset_types (company_id, name)
select c.id, t.name from public.companies c
cross join (values ('Mobiliario'), ('Decoraciones'), ('Equipo de evento'), ('Suministro'), ('Tecnología'), ('Vestuario')) as t(name)
on conflict do nothing;

insert into public.asset_locations (company_id, name)
select c.id, l.name from public.companies c
cross join (values ('Almacén'), ('Oficina')) as l(name)
on conflict do nothing;
