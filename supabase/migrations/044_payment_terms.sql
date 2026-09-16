-- Fase 1 del módulo financiero avanzado: catálogo de Condiciones de pago,
-- configurable sin tocar código (mismo patrón que bank_catalog/tax_rates/
-- expense_categories), + integración en Cotizaciones y Facturas con
-- cálculo automático de vencimiento.

create table if not exists public.payment_terms (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  credit_days int not null default 0 check (credit_days >= 0),
  payment_method text not null default 'TRANSFER' check (
    payment_method in ('TRANSFER', 'DEPOSIT', 'CHECK', 'CARD', 'CASH', 'OTHER')
  ),
  advance_percent numeric(5, 2) not null default 100 check (advance_percent >= 0 and advance_percent <= 100),
  balance_percent numeric(5, 2) not null default 0 check (balance_percent >= 0 and balance_percent <= 100),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, name),
  constraint payment_terms_percent_sum check (advance_percent + balance_percent = 100)
);

create index if not exists idx_payment_terms_company on public.payment_terms (company_id);

alter table public.payment_terms enable row level security;

create policy payment_terms_select on public.payment_terms for select
  using (company_id in (select public.user_company_ids()));

create policy payment_terms_insert on public.payment_terms for insert
  with check (company_id in (select public.user_company_ids()) and public.has_permission('settings.manage'));

create policy payment_terms_update on public.payment_terms for update
  using (company_id in (select public.user_company_ids()) and public.has_permission('settings.manage'))
  with check (company_id in (select public.user_company_ids()) and public.has_permission('settings.manage'));

create policy payment_terms_delete on public.payment_terms for delete
  using (company_id in (select public.user_company_ids()) and public.has_permission('settings.manage'));

create trigger set_updated_at
  before update on public.payment_terms
  for each row
  execute function public.set_updated_at();

-- Prellenado con las condiciones más comunes, tal como las pidió el usuario.
insert into public.payment_terms (company_id, name, credit_days, payment_method, advance_percent, balance_percent)
select c.id, t.name, t.credit_days, 'TRANSFER', t.advance_percent, t.balance_percent
from public.companies c
cross join (values
  ('Contado', 0, 100, 0),
  ('Crédito 15 días', 15, 100, 0),
  ('Crédito 30 días', 30, 100, 0),
  ('Crédito 45 días', 45, 100, 0),
  ('Crédito 60 días', 60, 100, 0),
  ('50% anticipo / 50% al finalizar', 0, 50, 50)
) as t(name, credit_days, advance_percent, balance_percent)
on conflict (company_id, name) do nothing;

-- Cotizaciones: se guarda tanto la referencia al catálogo como los valores
-- "congelados" al momento de cotizar (mismo criterio que exchange_rate) —
-- si el catálogo cambia después, las cotizaciones ya hechas no se alteran.
alter table public.quotations
  add column if not exists payment_terms_id uuid references public.payment_terms (id) on delete set null,
  add column if not exists credit_days int,
  add column if not exists payment_method text,
  add column if not exists advance_percent numeric(5, 2),
  add column if not exists balance_percent numeric(5, 2);

-- Facturas: mismo criterio. due_date se sigue pudiendo guardar manualmente
-- (por si no hay condición de pago elegida), pero cuando SÍ hay una, la
-- calcula automáticamente el trigger de abajo.
alter table public.invoices
  add column if not exists payment_terms_id uuid references public.payment_terms (id) on delete set null,
  add column if not exists credit_days int;

-- Vencimiento automático: fecha de emisión + días de crédito de la
-- condición de pago. Se recalcula si cambia la fecha de emisión o los
-- días de crédito (ej. al editar el borrador). Si no hay condición de
-- pago (credit_days is null), no toca due_date — se puede seguir
-- escribiendo a mano como hasta ahora.
create or replace function public.calculate_invoice_due_date()
returns trigger
language plpgsql
as $$
begin
  if new.credit_days is not null then
    new.due_date := new.issue_date + (new.credit_days || ' days')::interval;
  end if;
  return new;
end;
$$;

drop trigger if exists calculate_invoice_due_date_trigger on public.invoices;
create trigger calculate_invoice_due_date_trigger
  before insert or update on public.invoices
  for each row
  execute function public.calculate_invoice_due_date();
