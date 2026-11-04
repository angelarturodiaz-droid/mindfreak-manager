-- 098 — Anular un activo registrado por error (5c).
--
-- «Dado de baja» = lo tuvimos y ya no se usa. «Anulado» = nunca debió registrarse (error).
-- Al anular: estado ANULADO, motivo obligatorio (≥ 10 letras), quién y cuándo, y se suelta del gasto
-- (expense_id = null). El gasto no cambia. Nada se borra: queda en el historial y en la Auditoría.
-- Un activo anulado ya no se puede editar. Su código no se reutiliza.
-- Idempotente.

alter table public.assets
  add column if not exists void_reason text,
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid;

alter table public.assets drop constraint if exists assets_status_check;
alter table public.assets add constraint assets_status_check
  check (status in ('EN_USO', 'EN_REPARACION', 'DADO_DE_BAJA', 'ANULADO'));

-- Validaciones: un anulado no se toca; solo se anula con motivo (por la función void_asset).
create or replace function public.assets_guard_void()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status = 'ANULADO' then
    raise exception 'asset_voided: este activo está anulado y ya no se puede cambiar';
  end if;
  if new.status = 'ANULADO' and length(trim(coalesce(new.void_reason, ''))) < 10 then
    raise exception 'reason_required: escribe el motivo de la anulación (mínimo 10 letras)';
  end if;
  if new.status <> 'ANULADO' then
    new.void_reason := null;
    new.voided_at := null;
    new.voided_by := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_assets_guard_void on public.assets;
create trigger trg_assets_guard_void
  before update on public.assets
  for each row execute function public.assets_guard_void();

-- Historial: también el motivo de la anulación y cuando se suelta / liga un gasto.
create or replace function public.assets_log_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_loc text;
  v_new_loc text;
  v_old_exp text;
  v_new_exp text;
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
  if new.status = 'ANULADO' and old.status <> 'ANULADO' then
    insert into public.asset_events (company_id, asset_id, field, new_value)
    values (new.company_id, new.id, 'void_reason', new.void_reason);
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
  if new.expense_id is distinct from old.expense_id then
    select description into v_old_exp from public.expenses where id = old.expense_id;
    select description into v_new_exp from public.expenses where id = new.expense_id;
    insert into public.asset_events (company_id, asset_id, field, old_value, new_value)
    values (new.company_id, new.id, 'expense', v_old_exp, v_new_exp);
  end if;
  return new;
end;
$$;

revoke execute on function public.assets_log_events() from public, anon, authenticated;

-- Anular (security invoker: aplica RLS; exige assets.manage).
create or replace function public.void_asset(p_asset_id uuid, p_reason text)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_status text;
begin
  if not public.has_permission('assets.manage') then
    raise exception 'insufficient_privilege: falta el permiso assets.manage';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 10 then
    raise exception 'reason_required: escribe el motivo de la anulación (mínimo 10 letras)';
  end if;
  select status into v_status from public.assets where id = p_asset_id for update;
  if not found then
    raise exception 'asset_not_found: el activo no existe';
  end if;
  if v_status = 'ANULADO' then
    raise exception 'asset_voided: este activo ya está anulado';
  end if;
  update public.assets
     set status = 'ANULADO',
         void_reason = trim(p_reason),
         voided_at = now(),
         voided_by = auth.uid(),
         expense_id = null
   where id = p_asset_id;
end;
$$;

revoke execute on function public.void_asset(uuid, text) from public, anon;
grant execute on function public.void_asset(uuid, text) to authenticated;
