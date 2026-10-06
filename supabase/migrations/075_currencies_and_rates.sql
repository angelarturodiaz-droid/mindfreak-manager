-- 075: Multimoneda operacional V5 — paso 1: monedas y tasas
-- (ver claude/propuesta-multimoneda-pagos.md, aprobada el 4-oct-2026).
--
-- * currencies: catálogo de monedas por empresa (DOP, USD, EUR…). Reemplaza
--   las listas fijas DOP|USD de los formularios. La moneda funcional sigue
--   siendo companies.base_currency (no se duplica).
-- * currency_settings: Configuración → Monedas y tasas (fuente de la tasa de
--   referencia y tolerancia de redondeo, inicial 1.00 en moneda funcional).
-- * exchange_rates (ya existía, vacía): tasas de referencia por fecha con
--   fuente BCRD_DGII / MANUAL / BANK / OTHER. Convención única:
--   1 unidad de moneda no funcional = rate_to_base unidades de moneda funcional.
-- * Regla de oro del banco: un movimiento solo puede estar en la moneda de su
--   cuenta (trigger trg_bank_transaction_a_currency_guard). Producción:
--   0 movimientos en otra moneda (verificado el 5-oct), así que no rompe nada.
--   Mientras no estén los pasos 2–4 de V5, un pago/cobro desde una cuenta en
--   otra moneda queda bloqueado con un mensaje claro (antes restaba pesos
--   como dólares).
--
-- Idempotente. Aplicada en producción el 5-oct-2026 (partes A y B).

-- ===================== PARTE A =====================

-- 1) Catálogo de monedas
create table if not exists public.currencies (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  code text not null check (code ~ '^[A-Z]{3}$'),
  name text not null check (length(btrim(name)) between 2 and 60),
  symbol text not null default '' check (length(symbol) <= 8),
  decimals smallint not null default 2 check (decimals between 0 and 4),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, code)
);

drop trigger if exists set_updated_at on public.currencies;
create trigger set_updated_at before update on public.currencies
  for each row execute function public.set_updated_at();

alter table public.currencies enable row level security;

drop policy if exists currencies_select on public.currencies;
create policy currencies_select on public.currencies for select to authenticated
  using (company_id in (select public.user_company_ids()));
drop policy if exists currencies_insert on public.currencies;
create policy currencies_insert on public.currencies for insert to authenticated
  with check (company_id in (select public.user_company_ids()) and public.has_permission('settings.manage'));
drop policy if exists currencies_update on public.currencies;
create policy currencies_update on public.currencies for update to authenticated
  using (company_id in (select public.user_company_ids()) and public.has_permission('settings.manage'))
  with check (company_id in (select public.user_company_ids()) and public.has_permission('settings.manage'));

insert into public.currencies (company_id, code, name, symbol, decimals, is_active)
select c.id, v.code, v.name, v.symbol, 2, v.active
from public.companies c
cross join (values
  ('DOP', 'Peso dominicano', 'RD$', true),
  ('USD', 'Dólar estadounidense', 'US$', true),
  ('EUR', 'Euro', '€', false)
) as v(code, name, symbol, active)
on conflict (company_id, code) do nothing;

-- Toda moneda ya usada en cuentas o documentos queda en el catálogo y activa.
insert into public.currencies (company_id, code, name, symbol, decimals, is_active)
select distinct x.company_id, x.currency, x.currency, '', 2, true
from (
  select company_id, currency from public.bank_accounts
  union select company_id, currency from public.invoices
  union select company_id, currency from public.quotations
  union select company_id, currency from public.expenses
  union select id, base_currency from public.companies
) x
where x.currency ~ '^[A-Z]{3}$'
on conflict (company_id, code) do update set is_active = true;

-- 2) Configuración de monedas y tasas
create table if not exists public.currency_settings (
  company_id uuid primary key references public.companies (id) on delete cascade,
  reference_rate_source text not null default 'MANUAL'
    check (reference_rate_source in ('BCRD_DGII', 'MANUAL', 'BANK', 'OTHER')),
  reference_source_name text check (reference_source_name is null or length(reference_source_name) <= 80),
  rounding_tolerance numeric(14, 2) not null default 1.00 check (rounding_tolerance >= 0 and rounding_tolerance <= 1000),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

drop trigger if exists set_updated_at on public.currency_settings;
create trigger set_updated_at before update on public.currency_settings
  for each row execute function public.set_updated_at();

alter table public.currency_settings enable row level security;

drop policy if exists currency_settings_select on public.currency_settings;
create policy currency_settings_select on public.currency_settings for select to authenticated
  using (company_id in (select public.user_company_ids()));
drop policy if exists currency_settings_insert on public.currency_settings;
create policy currency_settings_insert on public.currency_settings for insert to authenticated
  with check (company_id in (select public.user_company_ids()) and public.has_permission('settings.manage'));
drop policy if exists currency_settings_update on public.currency_settings;
create policy currency_settings_update on public.currency_settings for update to authenticated
  using (company_id in (select public.user_company_ids()) and public.has_permission('settings.manage'))
  with check (company_id in (select public.user_company_ids()) and public.has_permission('settings.manage'));

insert into public.currency_settings (company_id)
select id from public.companies
on conflict (company_id) do nothing;

-- 3) Tasas de referencia por fecha (tabla de la migración 004, vacía)
alter table public.exchange_rates
  add column if not exists source_name text,
  add column if not exists notes text;
alter table public.exchange_rates alter column source set default 'MANUAL';
alter table public.exchange_rates drop constraint if exists exchange_rates_rate_positive;
alter table public.exchange_rates add constraint exchange_rates_rate_positive check (rate_to_base > 0);
alter table public.exchange_rates drop constraint if exists exchange_rates_code_format;
alter table public.exchange_rates add constraint exchange_rates_code_format check (currency_code ~ '^[A-Z]{3}$');
-- Los valores nuevos de "source" se habilitan en la PARTE B (al final).

-- 4) Regla de oro del banco: el movimiento va en la moneda de su cuenta
create or replace function public.bank_transaction_currency_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account record;
begin
  select name, currency into v_account from public.bank_accounts where id = new.bank_account_id;
  if found and new.currency is distinct from v_account.currency then
    raise exception 'currency_mismatch: Moneda diferente. El movimiento está en % pero la cuenta «%» está en %. El saldo de una cuenta solo se mueve en su propia moneda; los pagos y cobros desde una cuenta en una moneda diferente estarán disponibles cuando se habilite el módulo multimoneda.',
      new.currency, v_account.name, v_account.currency;
  end if;
  return new;
end;
$$;

revoke all on function public.bank_transaction_currency_guard() from public, anon, authenticated;

-- El nombre empieza por "a_" para que corra ANTES que la regla de fondos
-- (los triggers del mismo momento se ejecutan en orden alfabético).
drop trigger if exists trg_bank_transaction_a_currency_guard on public.bank_transactions;
create trigger trg_bank_transaction_a_currency_guard
  before insert or update of currency, bank_account_id on public.bank_transactions
  for each row execute function public.bank_transaction_currency_guard();

-- ===================== PARTE B: fuentes nuevas de la tasa =====================
alter table public.exchange_rates drop constraint if exists exchange_rates_source_check;
alter table public.exchange_rates add constraint exchange_rates_source_check
  check (source in ('BCRD_DGII', 'MANUAL', 'BANK', 'OTHER'));
