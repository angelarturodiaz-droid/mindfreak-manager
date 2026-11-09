-- A1 · Limpieza controlada de datos de prueba antes del Go-Live (8-nov-2026).
-- Propuesta: claude/propuesta-limpieza-golive.md (secciones 11 y 12; decisiones del 6-oct, 22-oct y 8-nov).
--
-- Qué hace:
--   * golive_preview()           → cuenta lo que se borraría y lo que se conserva (no borra nada).
--   * golive_execute(...)        → borra los datos de prueba en UNA transacción (todo o nada).
--   * golive_storage_*           → la app borra después los archivos de Storage con la sesión del administrador.
--   * golive_validate()          → comprobaciones automáticas posteriores.
--   * golive_declare(...)        → «Declarar Go-Live»: bloquea la limpieza para siempre.
-- Candados: permiso golive.manage (solo ADMIN) + verificación en dos pasos en esta sesión (aal2) + base marcada
-- PRODUCCIÓN + sin Go-Live declarado + respaldo COMPLETO de las últimas 24 h + vista previa de los últimos 30 min con
-- los mismos conteos + nombre de la empresa escrito a mano.
-- Red de seguridad (decisión 8-nov): el ZIP del respaldo (A0). No hay copia interna ni botón «Deshacer».
--
-- Este archivo SOLO crea tablas, un permiso, funciones y una política: no borra nada al aplicarse.
-- El borrado ocurre únicamente cuando un administrador ejecuta golive_execute desde la pantalla.

-- 1. Permiso ---------------------------------------------------------------------------------------------------------
insert into public.permissions (code, module, description) values
  ('golive.manage', 'settings', 'Preparar el Go-Live: limpiar los datos de prueba y declarar el inicio real')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code = 'golive.manage'
where r.company_id is null and r.name = 'ADMIN'
on conflict do nothing;

-- 2. Ambiente (una fila por empresa) ---------------------------------------------------------------------------------
create table if not exists public.system_environment (
  company_id uuid primary key references public.companies(id),
  environment text not null check (environment in ('DEVELOPMENT', 'PRODUCTION')),
  go_live_at timestamptz,
  go_live_by uuid references public.profiles(id),
  cleanup_locked boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Esta base es la de producción (decisión 6-oct). La de pruebas, cuando exista, se marca DEVELOPMENT a mano.
insert into public.system_environment (company_id, environment)
select id, 'PRODUCTION' from public.companies
on conflict (company_id) do nothing;

alter table public.system_environment enable row level security;
drop policy if exists system_environment_select on public.system_environment;
create policy system_environment_select on public.system_environment
  for select using (company_id in (select public.user_company_ids()));
-- Sin políticas de escritura: solo las funciones de abajo (y SQL directo del dueño de la base).

-- 3. Registro de cada vista previa / ejecución ------------------------------------------------------------------------
create table if not exists public.golive_cleanup_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  mode text not null check (mode in ('PREVIEW', 'EXECUTE')),
  status text not null check (status in ('PREVIEW', 'STORAGE_PENDING', 'DONE')),
  counts jsonb not null,            -- [{key, label, count}] lo que se borra
  kept jsonb not null,              -- {tabla: filas} lo que se conserva (para validar después)
  lists jsonb not null,             -- nombres de clientes, proveedores, cuentas y activos que se borran
  files jsonb not null,             -- [{bucket, path}] archivos de Storage que se borran
  files_left int,
  preview_id uuid references public.golive_cleanup_runs(id),
  backup_run_id uuid references public.backup_runs(id),
  run_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists golive_cleanup_runs_company_idx on public.golive_cleanup_runs (company_id, created_at desc);

alter table public.golive_cleanup_runs enable row level security;
drop policy if exists golive_cleanup_runs_select on public.golive_cleanup_runs;
create policy golive_cleanup_runs_select on public.golive_cleanup_runs
  for select using (company_id in (select public.user_company_ids()) and public.has_permission('golive.manage'));

-- 4. Helpers ---------------------------------------------------------------------------------------------------------
create or replace function public.golive_company()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select company_id from public.user_roles where user_id = auth.uid() and company_id is not null limit 1),
    (select id from public.companies order by created_at limit 1)
  );
$$;

-- Permiso + dos pasos en esta sesión. p_need_open = además exige PRODUCCIÓN y sin Go-Live declarado.
create or replace function public.golive_assert_allowed(p_need_open boolean default true)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_company uuid := public.golive_company();
  v_env public.system_environment;
begin
  if not public.has_permission('golive.manage') then
    raise exception 'golive_forbidden: solo un Administrador puede preparar el Go-Live.' using errcode = 'P0001';
  end if;
  if coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception 'golive_needs_aal2: confirma tu código de verificación en dos pasos.' using errcode = 'P0001';
  end if;
  if p_need_open then
    select * into v_env from public.system_environment where company_id = v_company;
    if v_env.company_id is null or v_env.environment <> 'PRODUCTION' then
      raise exception 'golive_not_production: esta base no está marcada como PRODUCCIÓN.' using errcode = 'P0001';
    end if;
    if v_env.cleanup_locked or v_env.go_live_at is not null then
      raise exception 'golive_locked: el Go-Live ya fue declarado; la limpieza está bloqueada para siempre. Las correcciones se hacen con anulaciones.' using errcode = 'P0001';
    end if;
  end if;
  return v_company;
end;
$$;

-- Qué se borra: proveedores marcados «Proveedor» o con movimientos (los del Directorio que no son proveedores se
-- conservan) y activos anulados o comprados con un gasto (los gastos son de prueba).
create or replace function public.golive_supplier_ids(p_company uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select s.id from public.suppliers s
   where s.company_id = p_company
     and (coalesce(s.directory_status, 'PROVEEDOR') = 'PROVEEDOR'
          or exists (select 1 from public.expenses e where e.supplier_id = s.id)
          or exists (select 1 from public.supplier_payments p where p.supplier_id = s.id)
          or exists (select 1 from public.bank_transactions b where b.supplier_id = s.id));
$$;

create or replace function public.golive_asset_ids(p_company uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select a.id from public.assets a
   where a.company_id = p_company and (a.status = 'ANULADO' or a.expense_id is not null);
$$;

-- Documentos que se borran: todos los de operaciones; de proveedores y activos, solo los de los que se borran.
create or replace function public.golive_document_ids(p_company uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select d.id from public.documents d
   where d.company_id = p_company
     and (d.entity_type not in ('supplier', 'asset')
          or (d.entity_type = 'supplier' and d.entity_id in (select public.golive_supplier_ids(p_company)))
          or (d.entity_type = 'asset' and d.entity_id in (select public.golive_asset_ids(p_company))));
$$;

-- Archivos de Storage que se borran: todo lo de la empresa en `documents` salvo el logo (carpeta branding) y los
-- archivos de documentos que se conservan; en el bucket `branding`, todo salvo el logo vigente.
create or replace function public.golive_file_list(p_company uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, storage
as $$
  select coalesce(jsonb_agg(jsonb_build_object('bucket', f.bucket_id, 'path', f.name) order by f.bucket_id, f.name), '[]'::jsonb)
  from (
    select o.bucket_id, o.name
      from storage.objects o
     where o.bucket_id = 'documents'
       and (storage.foldername(o.name))[1] = p_company::text
       and coalesce((storage.foldername(o.name))[2], '') <> 'branding'
       and o.name not in (
         select d.storage_path from public.documents d
          where d.company_id = p_company
            and d.storage_path is not null
            and d.id not in (select public.golive_document_ids(p_company)))
    union all
    select o.bucket_id, o.name
      from storage.objects o
     where o.bucket_id = 'branding'
       and (storage.foldername(o.name))[1] = p_company::text
       and position(o.name in coalesce((select logo_url from public.companies where id = p_company), '')) = 0
  ) f;
$$;

-- Conteos (lo que se borra) en el orden en que se borra.
create or replace function public.golive_counts(p_company uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r jsonb := '[]'::jsonb;
  n bigint;
  rec record;
begin
  for rec in
    select * from (values
      ('bank_transactions', 'Movimientos de banco y transferencias'),
      ('customer_payment_withholdings', 'Retenciones de clientes'),
      ('customer_payments', 'Cobros'),
      ('customer_advance_movements', 'Movimientos de anticipos'),
      ('customer_advances', 'Anticipos (recibos ANT)'),
      ('supplier_payments', 'Pagos a proveedores'),
      ('payment_correction_requests', 'Solicitudes de corrección'),
      ('invoice_collection_history', 'Historial de cobro'),
      ('invoices', 'Facturas'),
      ('delivery_receipts', 'Acuses de entrega'),
      ('project_surveys', 'Encuestas enviadas (con respuestas)'),
      ('tasks', 'Tareas'),
      ('activities', 'Actividades'),
      ('projects', 'Proyectos'),
      ('quotations', 'Cotizaciones'),
      ('expenses', 'Gastos (con retenciones y cartas CR)'),
      ('approvals', 'Aprobaciones'),
      ('notifications', 'Avisos'),
      ('reminder_log', 'Historial de recordatorios'),
      ('import_batches', 'Cargas masivas'),
      ('exchange_rates', 'Tasas de cambio de prueba'),
      ('clients', 'Clientes (con contactos)'),
      ('bank_accounts', 'Cuentas de banco y tarjetas')
    ) v(t, label)
  loop
    execute format('select count(*) from public.%I where company_id = $1', rec.t) into n using p_company;
    r := r || jsonb_build_object('key', rec.t, 'label', rec.label, 'count', n);
  end loop;

  select count(*) into n from public.golive_supplier_ids(p_company);
  r := r || jsonb_build_object('key', 'suppliers', 'label', 'Proveedores (con contactos)', 'count', n);
  select count(*) into n from public.golive_asset_ids(p_company);
  r := r || jsonb_build_object('key', 'assets', 'label', 'Activos anulados o ligados a gastos de prueba', 'count', n);
  select count(*) into n from public.golive_document_ids(p_company);
  r := r || jsonb_build_object('key', 'documents', 'label', 'Documentos adjuntos (registro)', 'count', n);
  select count(*) into n from public.audit_logs where company_id = p_company;
  r := r || jsonb_build_object('key', 'audit_logs', 'label', 'Auditoría de pruebas (queda en el respaldo)', 'count', n);
  select count(*) into n from public.auth_login_attempts;
  r := r || jsonb_build_object('key', 'auth_login_attempts', 'label', 'Intentos de entrada fallidos', 'count', n);
  return r;
end;
$$;

-- Lo que se conserva (para mostrarlo y comprobar después que no cambió).
create or replace function public.golive_kept(p_company uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r jsonb := '{}'::jsonb;
  n bigint;
  t text;
begin
  foreach t in array array[
    'profiles', 'user_roles', 'roles', 'permissions', 'role_permissions', 'tax_rates', 'fiscal_classifications',
    'fiscal_rules', 'payment_terms', 'currencies', 'currency_settings', 'bank_catalog', 'expense_categories',
    'supplier_service_types', 'services', 'service_categories', 'directory_zones', 'directory_tags', 'survey_questions',
    'survey_settings', 'reminder_settings', 'retention_letter_settings', 'asset_types', 'asset_locations', 'companies']
  loop
    execute format('select count(*) from public.%I', t) into n;
    r := r || jsonb_build_object(t, n);
  end loop;
  select count(*) into n from public.suppliers s
   where s.company_id = p_company and s.id not in (select public.golive_supplier_ids(p_company));
  r := r || jsonb_build_object('suppliers', n);
  select count(*) into n from public.assets a
   where a.company_id = p_company and a.id not in (select public.golive_asset_ids(p_company));
  r := r || jsonb_build_object('assets', n);
  return r;
end;
$$;

create or replace function public.golive_lists(p_company uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'clients', coalesce((select jsonb_agg(c.name order by c.name) from public.clients c where c.company_id = p_company), '[]'::jsonb),
    'suppliers', coalesce((select jsonb_agg(s.name order by s.name) from public.suppliers s
                            where s.id in (select public.golive_supplier_ids(p_company))), '[]'::jsonb),
    'bank_accounts', coalesce((select jsonb_agg(b.name || ' (' || b.currency || ')' order by b.name) from public.bank_accounts b
                                where b.company_id = p_company), '[]'::jsonb),
    'assets', coalesce((select jsonb_agg(a.code || ' ' || a.description order by a.code) from public.assets a
                         where a.id in (select public.golive_asset_ids(p_company))), '[]'::jsonb)
  );
$$;

-- Referencias rotas en TODAS las llaves foráneas de public (debe dar vacío). Se usa al final de la ejecución y en
-- las validaciones: como la ejecución apaga los disparadores, esto es lo que garantiza que no quede nada suelto.
create or replace function public.golive_fk_orphans()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  rec record;
  n bigint;
  r jsonb := '[]'::jsonb;
begin
  for rec in
    select c.conrelid::regclass as child, c.confrelid::regclass as parent,
           a.attname as col, af.attname as pcol, c.conname
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
      join pg_attribute af on af.attrelid = c.confrelid and af.attnum = c.confkey[1]
     where c.contype = 'f' and c.connamespace = 'public'::regnamespace and array_length(c.conkey, 1) = 1
  loop
    execute format('select count(*) from %s x where x.%I is not null and not exists (select 1 from %s y where y.%I = x.%I)',
                   rec.child, rec.col, rec.parent, rec.pcol, rec.col) into n;
    if n > 0 then
      r := r || jsonb_build_object('fk', rec.conname, 'table', rec.child::text, 'count', n);
    end if;
  end loop;
  return r;
end;
$$;

-- 5. Vista previa (no borra nada) ------------------------------------------------------------------------------------
create or replace function public.golive_preview()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid := public.golive_assert_allowed(true);
  v_id uuid;
  v_counts jsonb := public.golive_counts(v_company);
  v_kept jsonb := public.golive_kept(v_company);
  v_lists jsonb := public.golive_lists(v_company);
  v_files jsonb := public.golive_file_list(v_company);
  v_backup record;
begin
  insert into public.golive_cleanup_runs (company_id, mode, status, counts, kept, lists, files, files_left, run_by, finished_at)
  values (v_company, 'PREVIEW', 'PREVIEW', v_counts, v_kept, v_lists, v_files, jsonb_array_length(v_files), auth.uid(), now())
  returning id into v_id;

  select id, started_at into v_backup from public.backup_runs
   where company_id = v_company and kind = 'FULL' and status = 'COMPLETADO' and started_at > now() - interval '24 hours'
   order by started_at desc limit 1;

  return jsonb_build_object('preview_id', v_id, 'counts', v_counts, 'kept', v_kept, 'lists', v_lists,
                            'file_count', jsonb_array_length(v_files),
                            'backup_ok', v_backup.id is not null, 'backup_at', v_backup.started_at,
                            'company_name', (select name from public.companies where id = v_company));
end;
$$;

-- 6. Ejecutar --------------------------------------------------------------------------------------------------------
create or replace function public.golive_execute(p_preview_id uuid, p_company_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid := public.golive_assert_allowed(true);
  v_preview public.golive_cleanup_runs;
  v_backup uuid;
  v_name text;
  v_counts jsonb;
  v_files jsonb;
  v_orphans jsonb;
  v_run uuid;
  v_sup uuid[];
  v_ast uuid[];
  v_doc uuid[];
begin
  select * into v_preview from public.golive_cleanup_runs
   where id = p_preview_id and company_id = v_company and mode = 'PREVIEW' and run_by = auth.uid();
  if v_preview.id is null or v_preview.created_at < now() - interval '30 minutes' then
    raise exception 'golive_preview_expired: haz la vista previa otra vez (vale 30 minutos).' using errcode = 'P0001';
  end if;

  select id into v_backup from public.backup_runs
   where company_id = v_company and kind = 'FULL' and status = 'COMPLETADO' and started_at > now() - interval '24 hours'
   order by started_at desc limit 1;
  if v_backup is null then
    raise exception 'golive_needs_backup: primero crea un respaldo completo (Configuración → Copias de seguridad). Debe ser de las últimas 24 horas.' using errcode = 'P0001';
  end if;

  select name into v_name from public.companies where id = v_company;
  if lower(btrim(coalesce(p_company_name, ''))) <> lower(btrim(v_name)) then
    raise exception 'golive_confirm_name: escribe el nombre de la empresa exactamente como aparece.' using errcode = 'P0001';
  end if;

  v_counts := public.golive_counts(v_company);
  -- La auditoría, los avisos y los intentos de entrada cambian solos con el uso: no cuentan para la comparación.
  if (select jsonb_agg(c) from jsonb_array_elements(v_counts) c
       where c ->> 'key' not in ('audit_logs', 'notifications', 'auth_login_attempts'))
     is distinct from
     (select jsonb_agg(c) from jsonb_array_elements(v_preview.counts) c
       where c ->> 'key' not in ('audit_logs', 'notifications', 'auth_login_attempts')) then
    raise exception 'golive_changed: los datos cambiaron desde la vista previa. Hazla otra vez.' using errcode = 'P0001';
  end if;
  v_files := public.golive_file_list(v_company);

  -- Conjuntos que dependen de otras tablas: se calculan ANTES de borrar.
  select array_agg(x) into v_sup from public.golive_supplier_ids(v_company) x;
  select array_agg(x) into v_ast from public.golive_asset_ids(v_company) x;
  select array_agg(x) into v_doc from public.golive_document_ids(v_company) x;
  v_sup := coalesce(v_sup, '{}'); v_ast := coalesce(v_ast, '{}'); v_doc := coalesce(v_doc, '{}');

  -- Sin disparadores (candados de documentos emitidos, avisos, bitácoras): se borra todo explícitamente, hijos antes
  -- que padres, y al final se comprueba que no quedó ninguna referencia rota (si queda una, se deshace todo).
  set local session_replication_role = replica;

  delete from public.bank_transactions where company_id = v_company;
  delete from public.customer_payment_withholdings where company_id = v_company;
  delete from public.customer_payments where company_id = v_company;
  delete from public.customer_advance_movements where company_id = v_company;
  delete from public.customer_advances where company_id = v_company;
  delete from public.supplier_payments where company_id = v_company;
  delete from public.payment_correction_requests where company_id = v_company;
  delete from public.invoice_collection_history where company_id = v_company;
  delete from public.invoice_items where invoice_id in (select id from public.invoices where company_id = v_company);
  delete from public.invoices where company_id = v_company;
  delete from public.delivery_receipt_items where company_id = v_company;
  delete from public.delivery_receipts where company_id = v_company;
  delete from public.project_survey_answers where company_id = v_company;
  delete from public.project_surveys where company_id = v_company;
  delete from public.tasks where company_id = v_company;
  delete from public.activities where company_id = v_company;
  delete from public.project_items where project_id in (select id from public.projects where company_id = v_company);
  delete from public.quotation_items where quotation_id in (select id from public.quotations where company_id = v_company);
  delete from public.projects where company_id = v_company;
  delete from public.quotations where company_id = v_company;
  delete from public.asset_events where asset_id = any (v_ast);
  delete from public.assets where id = any (v_ast);
  update public.assets set expense_id = null where company_id = v_company and expense_id is not null;
  delete from public.expenses where company_id = v_company;
  delete from public.approvals where company_id = v_company;
  delete from public.notifications where company_id = v_company;
  delete from public.reminder_log where company_id = v_company;
  delete from public.import_batches where company_id = v_company;
  delete from public.exchange_rates where company_id = v_company;
  delete from public.client_contacts where company_id = v_company;
  delete from public.clients where company_id = v_company;
  delete from public.supplier_tags where supplier_id = any (v_sup);
  delete from public.supplier_contacts where supplier_id = any (v_sup);
  delete from public.suppliers where id = any (v_sup);
  delete from public.bank_accounts where company_id = v_company;
  update public.suppliers set cover_document_id = null where company_id = v_company and cover_document_id = any (v_doc);
  update public.assets set cover_document_id = null where company_id = v_company and cover_document_id = any (v_doc);
  delete from public.documents where id = any (v_doc);
  delete from public.auth_login_attempts;
  delete from public.audit_logs where company_id = v_company;

  set local session_replication_role = origin;

  v_orphans := public.golive_fk_orphans();
  if jsonb_array_length(v_orphans) > 0 then
    raise exception 'golive_orphans: quedaron referencias rotas (%); no se borró nada.', v_orphans::text using errcode = 'P0001';
  end if;

  insert into public.golive_cleanup_runs (company_id, mode, status, counts, kept, lists, files, files_left,
                                          preview_id, backup_run_id, run_by, finished_at)
  values (v_company, 'EXECUTE', case when jsonb_array_length(v_files) > 0 then 'STORAGE_PENDING' else 'DONE' end,
          v_counts, v_preview.kept, v_preview.lists, v_files, jsonb_array_length(v_files), p_preview_id, v_backup, auth.uid(),
          case when jsonb_array_length(v_files) > 0 then null else now() end)
  returning id into v_run;

  -- Primer registro de la auditoría nueva.
  insert into public.audit_logs (company_id, user_id, action, entity_type, entity_id, new_values)
  values (v_company, auth.uid(), 'GO_LIVE_CLEANUP', 'golive_cleanup', v_run,
          jsonb_build_object('counts', v_counts, 'backup_run_id', v_backup, 'files', jsonb_array_length(v_files)));

  return jsonb_build_object('run_id', v_run, 'files', v_files, 'counts', v_counts);
end;
$$;

-- 7. Archivos de Storage: la app los borra con la sesión del administrador (sin llave de servicio) --------------------
create or replace function public.golive_storage_delete_allowed(p_bucket text, p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_permission('golive.manage')
     and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
     and exists (
       select 1 from public.golive_cleanup_runs r
        where r.company_id = public.golive_company()
          and r.mode = 'EXECUTE' and r.status = 'STORAGE_PENDING'
          and r.files @> jsonb_build_array(jsonb_build_object('bucket', p_bucket, 'path', p_name)));
$$;

drop policy if exists golive_cleanup_storage_delete on storage.objects;
create policy golive_cleanup_storage_delete on storage.objects
  for delete to authenticated
  using (bucket_id in ('documents', 'branding') and public.golive_storage_delete_allowed(bucket_id, name));

-- Storage borra con «delete … returning»: también hace falta poder ver la fila (el bucket branding no tiene política
-- de lectura). Solo mientras haya una limpieza pendiente y solo para los archivos de su lista.
drop policy if exists golive_cleanup_storage_select on storage.objects;
create policy golive_cleanup_storage_select on storage.objects
  for select to authenticated
  using (bucket_id = 'branding' and public.golive_storage_delete_allowed(bucket_id, name));

-- Al terminar (o al reintentar): cuenta cuántos de la lista siguen existiendo.
create or replace function public.golive_storage_finish(p_run_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  v_company uuid := public.golive_assert_allowed(false);
  v_run public.golive_cleanup_runs;
  v_left jsonb;
begin
  select * into v_run from public.golive_cleanup_runs where id = p_run_id and company_id = v_company and mode = 'EXECUTE';
  if v_run.id is null then
    raise exception 'golive_run: no se encontró esa limpieza.' using errcode = 'P0001';
  end if;
  select coalesce(jsonb_agg(f), '[]'::jsonb) into v_left
    from jsonb_array_elements(v_run.files) f
   where exists (select 1 from storage.objects o where o.bucket_id = f ->> 'bucket' and o.name = f ->> 'path');
  update public.golive_cleanup_runs
     set files_left = jsonb_array_length(v_left),
         status = case when jsonb_array_length(v_left) = 0 then 'DONE' else 'STORAGE_PENDING' end,
         finished_at = case when jsonb_array_length(v_left) = 0 then now() else null end
   where id = p_run_id;
  return jsonb_build_object('left', v_left);
end;
$$;

-- 8. Validaciones posteriores ----------------------------------------------------------------------------------------
create or replace function public.golive_validate()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid := public.golive_assert_allowed(false);
  v_run public.golive_cleanup_runs;
  v_counts jsonb := public.golive_counts(v_company);
  v_kept jsonb := public.golive_kept(v_company);
  v_left int;
  v_audit int;
  v_nonzero jsonb;
  v_kept_diff jsonb;
  v_orphans jsonb := public.golive_fk_orphans();
  v_docs_orphan int;
begin
  select * into v_run from public.golive_cleanup_runs
   where company_id = v_company and mode = 'EXECUTE' order by created_at desc limit 1;
  if v_run.id is null then
    return jsonb_build_object('ran', false);
  end if;

  select coalesce(jsonb_agg(c), '[]'::jsonb) into v_nonzero
    from jsonb_array_elements(v_counts) c where (c ->> 'count')::bigint > 0 and c ->> 'key' <> 'audit_logs';
  select coalesce(jsonb_agg(jsonb_build_object('table', k, 'before', v_run.kept -> k, 'now', v_kept -> k)), '[]'::jsonb)
    into v_kept_diff
    from jsonb_object_keys(v_run.kept) k where v_run.kept -> k is distinct from v_kept -> k;
  select count(*) into v_left
    from jsonb_array_elements(v_run.files) f
   where exists (select 1 from storage.objects o where o.bucket_id = f ->> 'bucket' and o.name = f ->> 'path');
  select count(*) into v_audit from public.audit_logs where company_id = v_company and created_at < v_run.created_at;
  select count(*) into v_docs_orphan from public.documents d
   where d.company_id = v_company and d.storage_path is not null
     and not exists (select 1 from storage.objects o where o.bucket_id = 'documents' and o.name = d.storage_path);

  return jsonb_build_object(
    'ran', true,
    'run_at', v_run.created_at,
    'checks', jsonb_build_array(
      jsonb_build_object('key', 'empty', 'ok', jsonb_array_length(v_nonzero) = 0, 'detail', v_nonzero),
      jsonb_build_object('key', 'orphans', 'ok', jsonb_array_length(v_orphans) = 0 and v_docs_orphan = 0,
                         'detail', jsonb_build_object('fk', v_orphans, 'documents_without_file', v_docs_orphan)),
      jsonb_build_object('key', 'kept', 'ok', jsonb_array_length(v_kept_diff) = 0, 'detail', v_kept_diff),
      jsonb_build_object('key', 'files', 'ok', v_left = 0, 'detail', v_left),
      jsonb_build_object('key', 'audit', 'ok', v_audit = 0
                           and exists (select 1 from public.audit_logs where company_id = v_company and action = 'GO_LIVE_CLEANUP'),
                         'detail', v_audit)
    ));
end;
$$;

-- 9. Declarar Go-Live (irreversible desde la app) --------------------------------------------------------------------
create or replace function public.golive_declare(p_company_name text)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid := public.golive_assert_allowed(true);
  v_name text;
  v_at timestamptz := now();
begin
  select name into v_name from public.companies where id = v_company;
  if lower(btrim(coalesce(p_company_name, ''))) <> lower(btrim(v_name)) then
    raise exception 'golive_confirm_name: escribe el nombre de la empresa exactamente como aparece.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.golive_cleanup_runs
                  where company_id = v_company and mode = 'EXECUTE' and status = 'DONE') then
    raise exception 'golive_needs_cleanup: primero haz la limpieza completa (incluidos los archivos).' using errcode = 'P0001';
  end if;
  update public.system_environment
     set go_live_at = v_at, go_live_by = auth.uid(), cleanup_locked = true, updated_at = now()
   where company_id = v_company;
  insert into public.audit_logs (company_id, user_id, action, entity_type, entity_id, new_values)
  values (v_company, auth.uid(), 'GO_LIVE_DECLARED', 'golive', v_company, jsonb_build_object('go_live_at', v_at));
  return v_at;
end;
$$;

-- 10. Permisos de ejecución ------------------------------------------------------------------------------------------
revoke execute on function public.golive_company() from public, anon;
revoke execute on function public.golive_assert_allowed(boolean) from public, anon, authenticated;
revoke execute on function public.golive_supplier_ids(uuid) from public, anon, authenticated;
revoke execute on function public.golive_asset_ids(uuid) from public, anon, authenticated;
revoke execute on function public.golive_document_ids(uuid) from public, anon, authenticated;
revoke execute on function public.golive_file_list(uuid) from public, anon, authenticated;
revoke execute on function public.golive_counts(uuid) from public, anon, authenticated;
revoke execute on function public.golive_kept(uuid) from public, anon, authenticated;
revoke execute on function public.golive_lists(uuid) from public, anon, authenticated;
revoke execute on function public.golive_fk_orphans() from public, anon, authenticated;
revoke execute on function public.golive_storage_delete_allowed(text, text) from public, anon;

grant execute on function public.golive_company() to authenticated;
grant execute on function public.golive_storage_delete_allowed(text, text) to authenticated;
revoke execute on function public.golive_preview() from public, anon;
revoke execute on function public.golive_execute(uuid, text) from public, anon;
revoke execute on function public.golive_storage_finish(uuid) from public, anon;
revoke execute on function public.golive_validate() from public, anon;
revoke execute on function public.golive_declare(text) from public, anon;
grant execute on function public.golive_preview() to authenticated;
grant execute on function public.golive_execute(uuid, text) to authenticated;
grant execute on function public.golive_storage_finish(uuid) to authenticated;
grant execute on function public.golive_validate() to authenticated;
grant execute on function public.golive_declare(text) to authenticated;
