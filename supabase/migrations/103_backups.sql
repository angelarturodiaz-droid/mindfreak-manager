-- A0 · Respaldo manual completo (8-nov-2026). Propuesta: claude/propuesta-backup-mindfreak.md (aprobada 6-oct y 8-nov).
-- El ERP no puede correr pg_dump (Cloudflare Workers): la base se exporta tabla por tabla con estas funciones y el ZIP se
-- arma en el navegador del administrador. Nada se guarda en Supabase ni pasa por terceros; backup_runs es solo un registro.
-- Sin DELETE ni cambios de datos: solo una tabla nueva, un permiso y funciones de lectura.

-- 1. Permiso ---------------------------------------------------------------------------------------------------------
insert into public.permissions (code, module, description) values
  ('backups.create', 'settings', 'Crear y descargar copias de seguridad (base de datos y documentos)')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code = 'backups.create'
where r.company_id is null and r.name = 'ADMIN'
on conflict do nothing;

-- 2. Registro de respaldos (sin datos: fecha, quién, tipo, tamaño, resultado) ----------------------------------------
create table if not exists public.backup_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  kind text not null check (kind in ('FULL', 'DB_ONLY')),
  status text not null default 'EN_PROCESO' check (status in ('EN_PROCESO', 'COMPLETADO', 'FALLIDO', 'INCOMPLETO')),
  started_by uuid references public.profiles(id),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  size_bytes bigint,
  table_count int,
  row_count bigint,
  file_count int,
  manifest_sha256 text,
  error text
);
create index if not exists backup_runs_company_started_idx on public.backup_runs (company_id, started_at desc);

alter table public.backup_runs enable row level security;
drop policy if exists backup_runs_select on public.backup_runs;
create policy backup_runs_select on public.backup_runs
  for select using (company_id in (select public.user_company_ids()) and public.has_permission('backups.create'));
-- Sin políticas de escritura: solo backup_start / backup_finish (security definer).

-- 3. Control de acceso común: permiso + verificación en dos pasos EN ESTA SESIÓN (aal2) ------------------------------
create or replace function public.backup_assert_allowed()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.has_permission('backups.create') then
    raise exception 'backup_forbidden: no tienes permiso para crear copias de seguridad.' using errcode = 'P0001';
  end if;
  if coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception 'backup_needs_aal2: confirma tu código de verificación en dos pasos para crear la copia.' using errcode = 'P0001';
  end if;
end;
$$;

-- Tablas que nunca salen del sistema (credenciales y control de acceso) y el propio registro.
create or replace function public.backup_excluded_tables()
returns text[]
language sql
immutable
as $$ select array['mfa_recovery_codes', 'mfa_trusted_devices', 'auth_login_attempts', 'backup_runs']::text[] $$;

-- 4. Iniciar / terminar ----------------------------------------------------------------------------------------------
create or replace function public.backup_start(p_kind text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_id uuid;
  v_last timestamptz;
begin
  perform public.backup_assert_allowed();
  if p_kind not in ('FULL', 'DB_ONLY') then
    raise exception 'backup_kind: tipo de copia no válido.' using errcode = 'P0001';
  end if;
  select company_id into v_company from public.user_roles where user_id = auth.uid() and company_id is not null limit 1;
  if v_company is null then
    select id into v_company from public.companies order by created_at limit 1;
  end if;

  -- Las que quedaron a medias (se cerró el navegador) pasan a INCOMPLETO a los 30 minutos.
  update public.backup_runs
     set status = 'INCOMPLETO', finished_at = now(), error = 'Se interrumpió (se cerró la ventana o se cortó la conexión).'
   where company_id = v_company and status = 'EN_PROCESO' and started_at < now() - interval '30 minutes';

  if exists (select 1 from public.backup_runs where company_id = v_company and status = 'EN_PROCESO') then
    raise exception 'backup_running: ya hay una copia en proceso. Espera a que termine.' using errcode = 'P0001';
  end if;
  select max(started_at) into v_last from public.backup_runs where company_id = v_company;
  if v_last is not null and v_last > now() - interval '5 minutes' then
    raise exception 'backup_too_soon: espera unos minutos entre una copia y otra (mínimo 5).' using errcode = 'P0001';
  end if;

  insert into public.backup_runs (company_id, kind, started_by) values (v_company, p_kind, auth.uid()) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.backup_finish(
  p_run_id uuid,
  p_status text,
  p_size_bytes bigint,
  p_table_count int,
  p_row_count bigint,
  p_file_count int,
  p_manifest_sha256 text,
  p_error text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_permission('backups.create') then
    raise exception 'backup_forbidden: no tienes permiso para crear copias de seguridad.' using errcode = 'P0001';
  end if;
  if p_status not in ('COMPLETADO', 'FALLIDO') then
    raise exception 'backup_status: estado no válido.' using errcode = 'P0001';
  end if;
  update public.backup_runs
     set status = p_status, finished_at = now(), size_bytes = p_size_bytes, table_count = p_table_count,
         row_count = p_row_count, file_count = p_file_count, manifest_sha256 = p_manifest_sha256, error = left(p_error, 500)
   where id = p_run_id and started_by = auth.uid() and status = 'EN_PROCESO';
end;
$$;

-- 5. Qué tablas se exportan y en qué orden (padres antes que hijos) --------------------------------------------------
create or replace function public.backup_list_tables()
returns table (table_name text, depth int, row_count bigint, columns text[], generated_columns text[])
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r record;
  v_count bigint;
begin
  perform public.backup_assert_allowed();
  for r in
    with recursive t as (
      select c.oid, c.relname::text as name
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and not (c.relname = any (public.backup_excluded_tables()))
    ),
    fk as (
      select distinct con.conrelid as child, con.confrelid as parent
      from pg_constraint con
      where con.contype = 'f' and con.conrelid <> con.confrelid
        and con.conrelid in (select oid from t) and con.confrelid in (select oid from t)
    ),
    d (oid, lvl) as (
      select oid, 0 from t
      union all
      select fk.child, d.lvl + 1 from d join fk on fk.parent = d.oid where d.lvl < 30
    )
    select t.oid, t.name, max(d.lvl) as lvl
    from t join d on d.oid = t.oid
    group by t.oid, t.name
    order by max(d.lvl), t.name
  loop
    execute format('select count(*) from public.%I', r.name) into v_count;
    table_name := r.name;
    depth := r.lvl;
    row_count := v_count;
    select array_agg(a.attname::text order by a.attnum) filter (where a.attgenerated = ''),
           coalesce(array_agg(a.attname::text order by a.attnum) filter (where a.attgenerated <> ''), '{}')
      into columns, generated_columns
      from pg_attribute a
     where a.attrelid = r.oid and a.attnum > 0 and not a.attisdropped;
    return next;
  end loop;
end;
$$;

-- 6. Filas de una tabla, de a poco, en JSON (sin columnas calculadas) ------------------------------------------------
create or replace function public.backup_export_table(p_table text, p_offset int, p_limit int)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_oid oid;
  v_order text;
  v_gen text[];
  v_rows jsonb;
begin
  perform public.backup_assert_allowed();
  select c.oid into v_oid
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and c.relname = p_table;
  if v_oid is null or p_table = any (public.backup_excluded_tables()) then
    raise exception 'backup_table: la tabla % no está en la lista de la copia.', p_table using errcode = 'P0001';
  end if;
  -- Orden estable por la clave primaria (todas las tablas tienen).
  select string_agg(format('%I', a.attname), ', ' order by array_position(i.indkey::int[], a.attnum::int))
    into v_order
    from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any (i.indkey)
   where i.indrelid = v_oid and i.indisprimary;
  select coalesce(array_agg(attname::text), '{}') into v_gen
    from pg_attribute where attrelid = v_oid and attnum > 0 and not attisdropped and attgenerated <> '';
  execute format(
    'select coalesce(jsonb_agg(to_jsonb(t) - $1), ''[]''::jsonb) from (select * from public.%I order by %s offset %s limit %s) t',
    p_table, coalesce(v_order, '1'), greatest(p_offset, 0), least(greatest(p_limit, 1), 2000)
  ) into v_rows using v_gen;
  return v_rows;
end;
$$;

-- 7. Usuarios: solo información funcional (nunca contraseñas, MFA, tokens ni sesiones) -------------------------------
create or replace function public.backup_export_auth_users()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  perform public.backup_assert_allowed();
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', u.id,
           'email', u.email,
           'phone', u.phone,
           'full_name', u.raw_user_meta_data ->> 'full_name',
           'created_at', u.created_at,
           'email_confirmed', u.email_confirmed_at is not null,
           'banned', u.banned_until is not null and u.banned_until > now()
         ) order by u.created_at), '[]'::jsonb)
    into v
    from auth.users u;
  return v;
end;
$$;

-- 8. Archivos de Storage (solo el bucket de la empresa; sin el bucket de prueba «branding») --------------------------
create or replace function public.backup_list_files()
returns table (bucket text, path text, size_bytes bigint, mime_type text, updated_at timestamptz)
language plpgsql
stable
security definer
set search_path = public, storage
as $$
begin
  perform public.backup_assert_allowed();
  return query
    select o.bucket_id::text, o.name::text, coalesce((o.metadata ->> 'size')::bigint, 0), o.metadata ->> 'mimetype', o.updated_at
      from storage.objects o
     where o.bucket_id = 'documents'
       and (storage.foldername(o.name))[1] in (select public.user_company_ids()::text)
     order by o.name;
end;
$$;

-- 9. Totales de control (para comprobar una restauración) ------------------------------------------------------------
create or replace function public.backup_control_totals()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.backup_assert_allowed();
  return jsonb_build_object(
    'invoices', (select jsonb_build_object('count', count(*), 'total', coalesce(sum(total), 0), 'balance', coalesce(sum(balance), 0)) from public.invoices),
    'customer_payments', (select jsonb_build_object('count', count(*), 'amount', coalesce(sum(amount), 0)) from public.customer_payments),
    'expenses', (select jsonb_build_object('count', count(*), 'total', coalesce(sum(total), 0), 'balance', coalesce(sum(balance), 0)) from public.expenses),
    'supplier_payments', (select jsonb_build_object('count', count(*), 'amount', coalesce(sum(amount), 0)) from public.supplier_payments),
    'bank_balances', (select coalesce(jsonb_object_agg(a.name || ' (' || a.currency || ')', b.current_balance order by a.name), '{}'::jsonb)
                        from public.bank_accounts a join public.bank_account_balances b on b.bank_account_id = a.id)
  );
end;
$$;

-- 10. Quién puede llamar a las funciones -----------------------------------------------------------------------------
revoke all on function public.backup_assert_allowed() from public, anon;
revoke all on function public.backup_start(text) from public, anon;
revoke all on function public.backup_finish(uuid, text, bigint, int, bigint, int, text, text) from public, anon;
revoke all on function public.backup_list_tables() from public, anon;
revoke all on function public.backup_export_table(text, int, int) from public, anon;
revoke all on function public.backup_export_auth_users() from public, anon;
revoke all on function public.backup_list_files() from public, anon;
revoke all on function public.backup_control_totals() from public, anon;
grant execute on function public.backup_start(text) to authenticated;
grant execute on function public.backup_finish(uuid, text, bigint, int, bigint, int, text, text) to authenticated;
grant execute on function public.backup_list_tables() to authenticated;
grant execute on function public.backup_export_table(text, int, int) to authenticated;
grant execute on function public.backup_export_auth_users() to authenticated;
grant execute on function public.backup_list_files() to authenticated;
grant execute on function public.backup_control_totals() to authenticated;

-- 11. Foto de la estructura de las tablas (columnas, tipos, clave primaria, columnas calculadas) y de la vista de saldos.
--     Va en el ZIP como database/estructura-tablas.sql: sirve para revisar o para una restauración de PRUEBA en una base
--     vacía. La estructura oficial (reglas, funciones, permisos) son las migraciones del código.
create or replace function public.backup_schema_snapshot()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v text;
begin
  perform public.backup_assert_allowed();
  select string_agg(ddl, E'\n' order by relname) into v from (
    select c.relname,
           format('create table public.%I (%s%s);', c.relname,
             string_agg(format('%I %s%s', a.attname, format_type(a.atttypid, a.atttypmod),
               case when a.attgenerated = 's' then format(' generated always as (%s) stored', pg_get_expr(d.adbin, d.adrelid)) else '' end),
               ', ' order by a.attnum),
             coalesce((select ', ' || pg_get_constraintdef(k.oid) from pg_constraint k where k.conrelid = c.oid and k.contype = 'p'), '')) as ddl
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
      left join pg_attrdef d on d.adrelid = c.oid and d.adnum = a.attnum
     where n.nspname = 'public' and c.relkind = 'r' and not (c.relname = any (public.backup_excluded_tables()))
     group by c.oid, c.relname
  ) x;
  return '-- Estructura de las tablas (solo para revisar o para una restauración de prueba)' || E'\n'
      || v || E'\n'
      || 'create view public.bank_account_balances as ' || pg_get_viewdef('public.bank_account_balances'::regclass, true) || E'\n';
end;
$$;
revoke all on function public.backup_schema_snapshot() from public, anon;
grant execute on function public.backup_schema_snapshot() to authenticated;
