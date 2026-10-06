-- 078: Multimoneda operacional V5 — paso 4: transferencias con el monto
-- realmente recibido y comisión (claude/propuesta-multimoneda-pagos.md).
--
-- create_bank_transfer, parámetros opcionales nuevos:
-- * p_to_amount: lo que realmente entró en la cuenta destino (moneda de esa
--   cuenta). Entre monedas distintas, si viene, la tasa efectiva sale de
--   los dos montos (moneda base ÷ moneda extranjera) y se guarda en el lado
--   extranjero; si no viene, se usa p_exchange_rate como antes. En la misma
--   moneda debe ser igual a lo que sale.
-- * p_fee: comisión que cobró el banco de ORIGEN (moneda de la cuenta de
--   origen). Es un movimiento EXPENSE aparte (BANK_FEE, Comisiones
--   bancarias) ligado a la transferencia (related_source_type =
--   'bank_transfer', related_source_id = transfer_group_id). Nunca cambia lo
--   transferido. Respeta la confirmación de sobregiro igual que la salida.
-- * p_reference_rate / p_reference_rate_source: tasa del día (informativa).
--   Con ella se calcula la diferencia informativa (positiva = desfavorable:
--   se entregó más valor del que se recibió) y se guarda en Auditoría. No es
--   ganancia ni pérdida contable.
-- * Ahora devuelve el transfer_group_id (antes no devolvía nada).
--
-- La versión anterior se RENOMBRA create_bank_transfer_old_063 y queda sin
-- permisos (Supabase pide confirmación para borrar funciones).
--
-- Idempotente. Aplicada en producción el 6-oct-2026.

do $do$
begin
  if to_regprocedure('public.create_bank_transfer(uuid, uuid, uuid, numeric, date, text, numeric, boolean)') is not null then
    alter function public.create_bank_transfer(uuid, uuid, uuid, numeric, date, text, numeric, boolean)
      rename to create_bank_transfer_old_063;
    revoke all on function public.create_bank_transfer_old_063(uuid, uuid, uuid, numeric, date, text, numeric, boolean)
      from public, anon, authenticated;
  end if;
end
$do$;

create or replace function public.create_bank_transfer(
  p_company_id uuid,
  p_from_account_id uuid,
  p_to_account_id uuid,
  p_amount numeric,
  p_transaction_date date,
  p_description text,
  p_exchange_rate numeric default null,
  p_confirm_overdraft boolean default false,
  p_to_amount numeric default null,
  p_fee numeric default null,
  p_reference_rate numeric default null,
  p_reference_rate_source text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from record;
  v_to record;
  v_user_id uuid := auth.uid();
  v_group_id uuid := gen_random_uuid();
  v_base text;
  v_to_amount numeric;
  v_from_rate numeric := 1;
  v_to_rate numeric := 1;
  v_effective numeric;
  v_fee numeric := coalesce(p_fee, 0);
  v_diff numeric;
begin
  if not public.has_permission('banks.create') then
    raise exception 'insufficient_privilege: falta el permiso banks.create';
  end if;

  if p_company_id not in (select * from public.user_company_ids()) then
    raise exception 'company_mismatch: no tienes acceso a esta compañía';
  end if;

  if p_from_account_id = p_to_account_id then
    raise exception 'invalid_accounts: la cuenta origen y destino no pueden ser la misma';
  end if;
  if p_amount <= 0 then
    raise exception 'invalid_amount: el monto debe ser mayor a 0';
  end if;
  if v_fee < 0 then
    raise exception 'invalid_amount: la comisión no puede ser negativa';
  end if;
  if p_to_amount is not null and p_to_amount <= 0 then
    raise exception 'invalid_amount: el monto recibido debe ser mayor a 0';
  end if;
  if p_reference_rate is not null and p_reference_rate <= 0 then
    raise exception 'invalid_amount: la tasa de referencia debe ser mayor a 0';
  end if;

  select * into v_from from public.bank_accounts where id = p_from_account_id;
  if not found or v_from.company_id <> p_company_id then
    raise exception 'account_not_found: la cuenta origen no existe o no pertenece a esta compañía';
  end if;

  select * into v_to from public.bank_accounts where id = p_to_account_id;
  if not found or v_to.company_id <> p_company_id then
    raise exception 'account_not_found: la cuenta destino no existe o no pertenece a esta compañía';
  end if;

  v_to_amount := p_amount;
  if v_from.currency <> v_to.currency then
    select base_currency into v_base from public.companies where id = p_company_id;
    if v_from.currency <> v_base and v_to.currency <> v_base then
      raise exception 'unsupported_currencies: una de las dos cuentas debe estar en la moneda base (%)', v_base;
    end if;

    if p_to_amount is not null then
      -- Monto real recibido: la tasa efectiva sale de los dos montos.
      v_to_amount := p_to_amount;
      if v_from.currency = v_base then
        v_effective := round(p_amount / p_to_amount, 6);   -- base enviada ÷ extranjera recibida
        v_to_rate := v_effective;
      else
        v_effective := round(p_to_amount / p_amount, 6);   -- base recibida ÷ extranjera enviada
        v_from_rate := v_effective;
      end if;
    else
      if p_exchange_rate is null or p_exchange_rate <= 0 then
        raise exception 'exchange_rate_required: indica cuánto entró en la cuenta destino (o la tasa) para transferir entre % y %', v_from.currency, v_to.currency;
      end if;
      v_effective := p_exchange_rate;
      if v_from.currency = v_base then
        v_to_amount := round(p_amount / p_exchange_rate, 2);
        v_to_rate := p_exchange_rate;
      else
        v_to_amount := round(p_amount * p_exchange_rate, 2);
        v_from_rate := p_exchange_rate;
      end if;
      if v_to_amount <= 0 then
        raise exception 'invalid_amount: el monto convertido debe ser mayor a 0';
      end if;
    end if;

    -- Diferencia informativa contra la tasa del día (moneda base).
    -- Positiva = desfavorable (se entregó más valor del que se recibió).
    if p_reference_rate is not null then
      v_diff := case
        when v_from.currency = v_base then round(p_amount - v_to_amount * p_reference_rate, 2)
        else round(p_amount * p_reference_rate - v_to_amount, 2)
      end;
    end if;
  else
    if p_to_amount is not null and p_to_amount <> p_amount then
      raise exception 'invalid_amount: entre cuentas de la misma moneda entra lo mismo que sale; si el banco cobró algo, indícalo como comisión';
    end if;
    -- Misma moneda extranjera: se conserva la tasa que se indique (reportes).
    if v_from.currency <> (select base_currency from public.companies where id = p_company_id) then
      v_from_rate := coalesce(p_reference_rate, p_exchange_rate, 1);
      v_to_rate := v_from_rate;
    end if;
  end if;

  insert into public.bank_transactions (
    company_id, bank_account_id, type, amount, currency, exchange_rate,
    transaction_date, description, transfer_group_id, counterpart_account_id,
    overdraft_confirmed
  ) values (
    p_company_id, p_from_account_id, 'TRANSFER', -p_amount, v_from.currency, v_from_rate,
    p_transaction_date, coalesce(p_description, 'Transferencia a ' || v_to.name),
    v_group_id, p_to_account_id,
    coalesce(p_confirm_overdraft, false)
  );

  insert into public.bank_transactions (
    company_id, bank_account_id, type, amount, currency, exchange_rate,
    transaction_date, description, transfer_group_id, counterpart_account_id
  ) values (
    p_company_id, p_to_account_id, 'TRANSFER', v_to_amount, v_to.currency, v_to_rate,
    p_transaction_date, coalesce(p_description, 'Transferencia desde ' || v_from.name),
    v_group_id, p_from_account_id
  );

  -- Comisión del banco de origen: movimiento aparte, ligado a la transferencia.
  if v_fee > 0 then
    insert into public.bank_transactions (
      company_id, bank_account_id, type, amount, currency, exchange_rate,
      transaction_date, description, category_id,
      system_concept, related_source_type, related_source_id, overdraft_confirmed
    ) values (
      p_company_id, p_from_account_id, 'EXPENSE', v_fee, v_from.currency, v_from_rate,
      p_transaction_date, 'Comisión bancaria — transferencia a ' || v_to.name,
      public.find_expense_category(p_company_id, 'Comisiones bancarias'),
      'BANK_FEE', 'bank_transfer', v_group_id,
      coalesce(p_confirm_overdraft, false)
    );
  end if;

  insert into public.audit_logs (company_id, user_id, action, entity_type, entity_id, new_values)
  values (
    p_company_id, v_user_id, 'CREATE', 'bank_transfer', p_from_account_id,
    jsonb_build_object(
      'transfer_group_id', v_group_id,
      'to_account_id', p_to_account_id, 'amount', p_amount,
      'to_amount', v_to_amount, 'exchange_rate', p_exchange_rate,
      'received_amount_given', p_to_amount is not null,
      'effective_rate', v_effective, 'bank_fee', v_fee,
      'reference_rate', p_reference_rate, 'reference_rate_source', p_reference_rate_source,
      'informative_difference', v_diff,
      'overdraft_confirmed', coalesce(p_confirm_overdraft, false)
    )
  );

  return v_group_id;
end;
$$;

revoke all on function public.create_bank_transfer(uuid, uuid, uuid, numeric, date, text, numeric, boolean, numeric, numeric, numeric, text) from public, anon;
grant execute on function public.create_bank_transfer(uuid, uuid, uuid, numeric, date, text, numeric, boolean, numeric, numeric, numeric, text) to authenticated, service_role;

-- Limpieza opcional (pegar en el SQL Editor cuando se quiera; no afecta nada):
-- drop function if exists public.create_bank_transfer_old_063(uuid, uuid, uuid, numeric, date, text, numeric, boolean);
