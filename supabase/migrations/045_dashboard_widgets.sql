-- Fase 3 del módulo financiero avanzado: Dashboard configurable por
-- usuario. Cada usuario guarda su propia lista de widgets (tipo, visible,
-- tamaño, orden = posición en el array JSON) — persiste entre sesiones,
-- no se pierde al cerrar sesión ni recargar.

create table if not exists public.dashboard_widget_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  widgets jsonb not null default '[]',
  updated_at timestamptz not null default now(),
  unique (user_id, company_id)
);

create index if not exists idx_dashboard_widgets_user on public.dashboard_widget_preferences (user_id, company_id);

alter table public.dashboard_widget_preferences enable row level security;

-- Cada quien solo ve y edita su propia configuración — no es algo que un
-- admin gestione por otros, es 100% personal (como pidió el usuario).
create policy dashboard_widgets_select on public.dashboard_widget_preferences for select
  using (user_id = (select auth.uid()));

create policy dashboard_widgets_insert on public.dashboard_widget_preferences for insert
  with check (
    user_id = (select auth.uid())
    and company_id in (select public.user_company_ids())
  );

create policy dashboard_widgets_update on public.dashboard_widget_preferences for update
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create trigger set_updated_at
  before update on public.dashboard_widget_preferences
  for each row
  execute function public.set_updated_at();
