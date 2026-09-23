-- Reconstruida desde producción (supabase_migrations.schema_migrations,
-- versión 20260923031002 "split_client_stage_from_status", commit aba70ab).
-- Se aplicó directo en Supabase el 2026-09-23 sin comitear el archivo.
-- Reescrita de forma idempotente: en producción (donde ya se aplicó) no
-- hace nada; en una base nueva deja clients igual que producción.
--
-- Separar "Etapa" (pipeline comercial) de "Estado" (activo/inactivo) en
-- clients: la columna status ('LEAD'/'ACTIVE') pasa a ser stage
-- ('LEAD'/'PROSPECT'/'CLIENT'); activo/inactivo queda solo en is_active.

do $$
begin
  -- 1) Renombrar status -> stage (solo si todavía no se hizo)
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'clients' and column_name = 'status'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'clients' and column_name = 'stage'
  ) then
    alter table public.clients drop constraint if exists clients_status_check;
    alter table public.clients rename column status to stage;
  end if;
end $$;

update public.clients set stage = 'CLIENT' where stage = 'ACTIVE';

alter table public.clients drop constraint if exists clients_stage_check;
alter table public.clients add constraint clients_stage_check
  check (stage = any (array['LEAD'::text, 'PROSPECT'::text, 'CLIENT'::text]));

alter table public.clients alter column stage set default 'LEAD';

alter index if exists public.idx_clients_status rename to idx_clients_stage;
create index if not exists idx_clients_stage on public.clients (stage);
