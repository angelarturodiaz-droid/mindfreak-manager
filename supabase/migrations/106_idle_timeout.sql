-- Cierre de sesión por inactividad (11-nov-2026). Minutos sin usar el sistema antes de cerrar la sesión en el
-- navegador (aviso 60 s antes). Se cambia en Configuración → Seguridad. Supabase lo ofrece solo en el plan Pro, por
-- eso lo hace la app. Valor inicial: 30 minutos.
alter table public.companies
  add column if not exists idle_timeout_minutes integer not null default 30;

alter table public.companies drop constraint if exists companies_idle_timeout_minutes_check;
alter table public.companies add constraint companies_idle_timeout_minutes_check
  check (idle_timeout_minutes between 5 and 240);
