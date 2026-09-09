-- F14: Bancos — balance calculado por cuenta + transferencias entre cuentas
-- Ver F0-Arquitectura sección G "Bancos" y prompt maestro sección 18.
--
-- Convención de signo en bank_transactions.amount:
--   INCOME  -> siempre positivo (ya usado desde F11, register_customer_payment)
--   EXPENSE -> siempre positivo, se resta (ya usado desde F13, register_supplier_payment)
--   TRANSFER -> se guarda CON SIGNO: negativo en la cuenta origen, positivo en
--               la cuenta destino (dos filas por transferencia, ver función abajo)

-- Vista con el balance calculado (opening_balance + movimientos). security_invoker
-- hace que la vista respete el RLS de bank_accounts/bank_transactions del usuario
-- que consulta, no del dueño de la vista.
create or replace view public.bank_account_balances
with (security_invoker = true) as
select
  a.id as bank_account_id,
  a.opening_balance + coalesce(sum(
    case
      when t.type = 'INCOME' then t.amount
      when t.type = 'EXPENSE' then -t.amount
      when t.type = 'TRANSFER' then t.amount
      else 0
    end
  ), 0) as current_balance
from public.bank_accounts a
left join public.bank_transactions t on t.bank_account_id = a.id
group by a.id, a.opening_balance;

-- Transferencia entre dos cuentas de la misma compañía. SECURITY DEFINER:
-- valida 'banks.create' explícitamente, y que ambas cuentas pertenezcan a la
-- compañía indicada. Inserta las dos filas (origen negativo, destino
-- positivo) en una sola transacción — si algo falla, rollback de ambas.
create or replace function public.create_bank_transfer(
  p_company_id uuid,
  p_from_account_id uuid,
  p_to_account_id uuid,
  p_amount numeric,
  p_transaction_date date,
  p_description text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from record;
  v_to record;
  v_user_id uuid := auth.uid();
begin
  if not public.has_permission('banks.create') then
    raise exception 'insufficient_privilege: falta el permiso banks.create';
  end if;
  if p_from_account_id = p_to_account_id then
    raise exception 'invalid_accounts: la cuenta origen y destino no pueden ser la misma';
  end if;
  if p_amount <= 0 then
    raise exception 'invalid_amount: el monto debe ser mayor a 0';
  end if;

  select * into v_from from public.bank_accounts where id = p_from_account_id;
  if not found or v_from.company_id <> p_company_id then
    raise exception 'account_not_found: la cuenta origen no existe o no pertenece a esta compañía';
  end if;

  select * into v_to from public.bank_accounts where id = p_to_account_id;
  if not found or v_to.company_id <> p_company_id then
    raise exception 'account_not_found: la cuenta destino no existe o no pertenece a esta compañía';
  end if;

  insert into public.bank_transactions (
    company_id, bank_account_id, type, amount, currency, exchange_rate,
    transaction_date, description
  ) values (
    p_company_id, p_from_account_id, 'TRANSFER', -p_amount, v_from.currency, 1,
    p_transaction_date, coalesce(p_description, 'Transferencia a ' || v_to.name)
  );

  insert into public.bank_transactions (
    company_id, bank_account_id, type, amount, currency, exchange_rate,
    transaction_date, description
  ) values (
    p_company_id, p_to_account_id, 'TRANSFER', p_amount, v_to.currency, 1,
    p_transaction_date, coalesce(p_description, 'Transferencia desde ' || v_from.name)
  );

  insert into public.audit_logs (company_id, user_id, action, entity_type, entity_id, new_values)
  values (
    p_company_id, v_user_id, 'CREATE', 'bank_transfer', p_from_account_id,
    jsonb_build_object('to_account_id', p_to_account_id, 'amount', p_amount)
  );
end;
$$;

revoke execute on function public.create_bank_transfer(
  uuid, uuid, uuid, numeric, date, text
) from public, anon;
