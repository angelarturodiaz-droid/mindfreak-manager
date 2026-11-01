-- 094 — 4b Carta de retención a proveedores (constancia de retención de ISR/ITBIS).
--
-- Solo lee lo que ya existe en el gasto (retenciones congeladas, NCF, pagos):
-- no toca el motor fiscal, las reglas ni net_payable. Agrega:
--   1. Textos de la carta en Configuración (destinatario DGII, párrafo legal, firmante).
--   2. Número consecutivo CR-0001 por gasto (se asigna la primera vez y no cambia).

create table if not exists public.retention_letter_settings (
  company_id uuid primary key references public.companies(id),
  addressee_name text not null default 'Lic. Pedro Porfirio Urrutia Sangiovanni',
  addressee_title text not null default 'Director General',
  legal_text text not null default 'Las retenciones detalladas fueron realizadas en virtud de la Ley 253-12 y sus modificaciones, de acuerdo con lo dispuesto en la Norma General 02-05 de fecha 17 de enero de 2005, modificada por la Norma General 07-09 de fecha 1 de septiembre de 2009.',
  signer_name text,
  signer_title text,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

alter table public.retention_letter_settings enable row level security;
drop policy if exists retention_letter_settings_select on public.retention_letter_settings;
create policy retention_letter_settings_select on public.retention_letter_settings
  for select to authenticated
  using (company_id in (select public.user_company_ids()));
drop policy if exists retention_letter_settings_write on public.retention_letter_settings;
create policy retention_letter_settings_write on public.retention_letter_settings
  for all to authenticated
  using (company_id in (select public.user_company_ids()) and public.has_permission('settings.manage'))
  with check (company_id in (select public.user_company_ids()) and public.has_permission('settings.manage'));

insert into public.retention_letter_settings (company_id)
select id from public.companies
on conflict (company_id) do nothing;

alter table public.expenses
  add column if not exists retention_letter_number text,
  add column if not exists retention_letter_at timestamptz;

create unique index if not exists uq_expenses_retention_letter_number
  on public.expenses(company_id, retention_letter_number) where retention_letter_number is not null;

-- Asigna (o devuelve) el número CR del gasto. Exige retenciones y al menos un pago activo.
create or replace function public.assign_retention_letter_number(p_expense_id uuid)
returns text
language plpgsql
security definer
set search_path = public
set "TimeZone" to 'America/Santo_Domingo'
as $$
declare
  v_exp record;
  v_next int;
  v_number text;
begin
  if not public.has_permission('payments.create') then
    raise exception 'insufficient_privilege: no tienes permiso para emitir cartas de retención';
  end if;
  select * into v_exp from public.expenses where id = p_expense_id for update;
  if not found or v_exp.company_id not in (select public.user_company_ids()) then
    raise exception 'not_found: el gasto no existe';
  end if;
  if coalesce(v_exp.isr_withheld, 0) + coalesce(v_exp.itbis_withheld, 0) <= 0 then
    raise exception 'no_withholding: este gasto no tiene retenciones de ISR ni de ITBIS';
  end if;
  if not exists (select 1 from public.supplier_payments where expense_id = p_expense_id and status = 'ACTIVE') then
    raise exception 'no_payment: la retención se hace al pagar: registra primero el pago al proveedor';
  end if;
  if v_exp.retention_letter_number is not null then
    return v_exp.retention_letter_number;
  end if;
  -- Bloqueo por compañía para que dos personas no tomen el mismo número.
  perform pg_advisory_xact_lock(hashtext('retention_letter:' || v_exp.company_id::text));
  select coalesce(max(substring(retention_letter_number from '[0-9]+$')::int), 0) + 1
    into v_next
    from public.expenses
   where company_id = v_exp.company_id and retention_letter_number is not null;
  v_number := 'CR-' || lpad(v_next::text, 4, '0');
  update public.expenses
     set retention_letter_number = v_number, retention_letter_at = now()
   where id = p_expense_id;
  insert into public.audit_logs (company_id, user_id, action, entity_type, entity_id, new_values)
  values (v_exp.company_id, auth.uid(), 'RETENTION_LETTER', 'expense', p_expense_id,
    jsonb_build_object('number', v_number, 'isr_withheld', v_exp.isr_withheld, 'itbis_withheld', v_exp.itbis_withheld));
  return v_number;
end;
$$;

revoke execute on function public.assign_retention_letter_number(uuid) from public, anon;
grant execute on function public.assign_retention_letter_number(uuid) to authenticated;
