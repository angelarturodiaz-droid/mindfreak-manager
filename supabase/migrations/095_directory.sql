-- 095 — 5 Directorio de Recursos y Aliados (extiende Proveedores).
--
-- Un solo registro por persona o empresa que avanza de estado:
--   PROSPECTO → EVALUADO → APROBADO → PROVEEDOR (+ INACTIVO).
-- Los proveedores actuales quedan como PROVEEDOR (o INACTIVO si están desactivados).
-- No cambia gastos, pagos, reportes ni reglas fiscales.

alter table public.suppliers
  add column if not exists directory_status text not null default 'PROVEEDOR',
  add column if not exists zone_id uuid,
  add column if not exists links jsonb not null default '{}'::jsonb,
  add column if not exists reference_price text,
  add column if not exists directory_notes text,
  add column if not exists rating smallint,
  add column if not exists cover_document_id uuid references public.documents(id) on delete set null;

alter table public.suppliers drop constraint if exists suppliers_directory_status_check;
alter table public.suppliers add constraint suppliers_directory_status_check
  check (directory_status in ('PROSPECTO', 'EVALUADO', 'APROBADO', 'PROVEEDOR', 'INACTIVO'));
alter table public.suppliers drop constraint if exists suppliers_rating_check;
alter table public.suppliers add constraint suppliers_rating_check check (rating is null or rating between 1 and 5);

update public.suppliers set directory_status = case when is_active then 'PROVEEDOR' else 'INACTIVO' end
 where directory_status = 'PROVEEDOR' and not is_active;

-- Listas de Configuración (para no duplicar «Bodas» / «bodas»).
create table if not exists public.directory_zones (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  name text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists uq_directory_zones_name on public.directory_zones(company_id, lower(name));

create table if not exists public.directory_tags (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  name text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists uq_directory_tags_name on public.directory_tags(company_id, lower(name));

create table if not exists public.supplier_tags (
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  tag_id uuid not null references public.directory_tags(id) on delete cascade,
  company_id uuid not null references public.companies(id),
  primary key (supplier_id, tag_id)
);

alter table public.suppliers drop constraint if exists suppliers_zone_id_fkey;
alter table public.suppliers add constraint suppliers_zone_id_fkey
  foreign key (zone_id) references public.directory_zones(id) on delete set null;

alter table public.directory_zones enable row level security;
alter table public.directory_tags enable row level security;
alter table public.supplier_tags enable row level security;

drop policy if exists directory_zones_select on public.directory_zones;
create policy directory_zones_select on public.directory_zones for select to authenticated
  using (company_id in (select public.user_company_ids()));
drop policy if exists directory_zones_write on public.directory_zones;
create policy directory_zones_write on public.directory_zones for all to authenticated
  using (company_id in (select public.user_company_ids()) and public.has_permission('settings.manage'))
  with check (company_id in (select public.user_company_ids()) and public.has_permission('settings.manage'));

drop policy if exists directory_tags_select on public.directory_tags;
create policy directory_tags_select on public.directory_tags for select to authenticated
  using (company_id in (select public.user_company_ids()));
drop policy if exists directory_tags_write on public.directory_tags;
create policy directory_tags_write on public.directory_tags for all to authenticated
  using (company_id in (select public.user_company_ids()) and public.has_permission('settings.manage'))
  with check (company_id in (select public.user_company_ids()) and public.has_permission('settings.manage'));

drop policy if exists supplier_tags_select on public.supplier_tags;
create policy supplier_tags_select on public.supplier_tags for select to authenticated
  using (company_id in (select public.user_company_ids()));
drop policy if exists supplier_tags_write on public.supplier_tags;
create policy supplier_tags_write on public.supplier_tags for all to authenticated
  using (company_id in (select public.user_company_ids()) and (public.has_permission('suppliers.update') or public.has_permission('suppliers.create')))
  with check (company_id in (select public.user_company_ids()) and (public.has_permission('suppliers.update') or public.has_permission('suppliers.create')));

-- Listas iniciales (el usuario las ajusta en Configuración → Directorio).
insert into public.directory_zones (company_id, name)
select c.id, z.name from public.companies c
cross join (values ('Santo Domingo (DN)'), ('Santo Domingo Este'), ('Santo Domingo Oeste'), ('Santo Domingo Norte'),
  ('Santiago'), ('La Romana'), ('Punta Cana / Bávaro'), ('Juan Dolio'), ('Puerto Plata'), ('Samaná'),
  ('Jarabacoa / Constanza'), ('Todo el país')) as z(name)
on conflict do nothing;

insert into public.directory_tags (company_id, name)
select c.id, t.name from public.companies c
cross join (values ('Bodas'), ('Corporativo'), ('Infantil'), ('Premium'), ('Económico'), ('Al aire libre'),
  ('Playa'), ('Congresos'), ('Lanzamientos'), ('Fiestas privadas'), ('Bilingüe'), ('Fines de semana')) as t(name)
on conflict do nothing;

-- Estado ↔ activo: INACTIVO = desactivado. Y protección del historial: con gastos
-- o pagos no vuelve a Prospecto / Evaluado / Aprobado.
create or replace function public.guard_supplier_directory_status()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_has_history boolean;
begin
  -- Desactivar / reactivar con el botón de siempre.
  if tg_op = 'UPDATE' and new.is_active is distinct from old.is_active and new.directory_status is not distinct from old.directory_status then
    if not new.is_active then
      new.directory_status := 'INACTIVO';
    elsif old.directory_status = 'INACTIVO' then
      select exists (select 1 from public.expenses e where e.supplier_id = new.id)
          or exists (select 1 from public.supplier_payments p where p.supplier_id = new.id)
        into v_has_history;
      new.directory_status := case when v_has_history then 'PROVEEDOR' else 'APROBADO' end;
    end if;
  end if;

  new.is_active := new.directory_status <> 'INACTIVO';

  if tg_op = 'UPDATE' and new.directory_status in ('PROSPECTO', 'EVALUADO', 'APROBADO')
     and new.directory_status is distinct from old.directory_status then
    select exists (select 1 from public.expenses e where e.supplier_id = new.id)
        or exists (select 1 from public.supplier_payments p where p.supplier_id = new.id)
      into v_has_history;
    if v_has_history then
      raise exception 'has_history: ya tiene gastos o pagos registrados: solo puede quedar como Proveedor o Inactivo';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_supplier_directory_status on public.suppliers;
create trigger trg_supplier_directory_status
  before insert or update on public.suppliers
  for each row execute function public.guard_supplier_directory_status();

-- Gasto a alguien del directorio: al guardar el gasto pasa solo a Proveedor.
create or replace function public.promote_supplier_on_expense()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.supplier_id is not null then
    update public.suppliers
       set directory_status = 'PROVEEDOR'
     where id = new.supplier_id and directory_status in ('PROSPECTO', 'EVALUADO', 'APROBADO');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_promote_supplier_on_expense on public.expenses;
create trigger trg_promote_supplier_on_expense
  after insert or update of supplier_id on public.expenses
  for each row execute function public.promote_supplier_on_expense();

revoke execute on function public.promote_supplier_on_expense() from public, anon, authenticated;
