-- Transferencias entre cuentas de monedas distintas (ej. pagar una
-- tarjeta de crédito en dólares desde una cuenta en pesos).
--
-- create_bank_transfer recibe un parámetro nuevo opcional p_exchange_rate
-- (unidades de moneda base por 1 unidad de la otra moneda, ej. 59.50 RD$
-- por US$). Si las dos cuentas tienen la misma moneda, todo sigue igual
-- que antes (la tasa no se usa). Si son distintas, la tasa es obligatoria:
-- sale el monto en la moneda de origen y entra el monto convertido en la
-- moneda destino; cada fila guarda su tasa a moneda base.
--
-- Como cambia la firma, se elimina la versión anterior (6 parámetros) para
-- que no queden dos funciones con el mismo nombre, y se vuelven a dar los
-- mismos permisos que tenía (solo usuarios autenticados; nunca anon).

drop function if exists public.create_bank_transfer(uuid, uuid, uuid, numeric, date, text);

CREATE OR REPLACE FUNCTION public.create_bank_transfer(p_company_id uuid, p_from_account_id uuid, p_to_account_id uuid, p_amount numeric, p_transaction_date date, p_description text, p_exchange_rate numeric DEFAULT NULL::numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_from record;
  v_to record;
  v_user_id uuid := auth.uid();
  v_group_id uuid := gen_random_uuid();
  v_base text;
  v_to_amount numeric;
  v_from_rate numeric := 1;
  v_to_rate numeric := 1;
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

  select * into v_from from public.bank_accounts where id = p_from_account_id;
  if not found or v_from.company_id <> p_company_id then
    raise exception 'account_not_found: la cuenta origen no existe o no pertenece a esta compañía';
  end if;

  select * into v_to from public.bank_accounts where id = p_to_account_id;
  if not found or v_to.company_id <> p_company_id then
    raise exception 'account_not_found: la cuenta destino no existe o no pertenece a esta compañía';
  end if;

  -- Monto que entra en la cuenta destino. Misma moneda: igual al que sale.
  -- Monedas distintas (ej. pesos -> tarjeta en dólares): se convierte con
  -- la tasa (unidades de moneda base por 1 unidad de la otra moneda) y
  -- cada fila guarda su tasa a moneda base para los reportes.
  v_to_amount := p_amount;
  if v_from.currency <> v_to.currency then
    if p_exchange_rate is null or p_exchange_rate <= 0 then
      raise exception 'exchange_rate_required: indica la tasa de cambio para transferir entre % y %', v_from.currency, v_to.currency;
    end if;
    select base_currency into v_base from public.companies where id = p_company_id;
    if v_from.currency = v_base then
      v_to_amount := round(p_amount / p_exchange_rate, 2);
      v_to_rate := p_exchange_rate;
    elsif v_to.currency = v_base then
      v_to_amount := round(p_amount * p_exchange_rate, 2);
      v_from_rate := p_exchange_rate;
    else
      raise exception 'unsupported_currencies: una de las dos cuentas debe estar en la moneda base (%)', v_base;
    end if;
    if v_to_amount <= 0 then
      raise exception 'invalid_amount: el monto convertido debe ser mayor a 0';
    end if;
  end if;

  insert into public.bank_transactions (
    company_id, bank_account_id, type, amount, currency, exchange_rate,
    transaction_date, description, transfer_group_id, counterpart_account_id
  ) values (
    p_company_id, p_from_account_id, 'TRANSFER', -p_amount, v_from.currency, v_from_rate,
    p_transaction_date, coalesce(p_description, 'Transferencia a ' || v_to.name),
    v_group_id, p_to_account_id
  );

  insert into public.bank_transactions (
    company_id, bank_account_id, type, amount, currency, exchange_rate,
    transaction_date, description, transfer_group_id, counterpart_account_id
  ) values (
    p_company_id, p_to_account_id, 'TRANSFER', v_to_amount, v_to.currency, v_to_rate,
    p_transaction_date, coalesce(p_description, 'Transferencia desde ' || v_from.name),
    v_group_id, p_from_account_id
  );

  insert into public.audit_logs (company_id, user_id, action, entity_type, entity_id, new_values)
  values (
    p_company_id, v_user_id, 'CREATE', 'bank_transfer', p_from_account_id,
    jsonb_build_object(
      'to_account_id', p_to_account_id, 'amount', p_amount,
      'to_amount', v_to_amount, 'exchange_rate', p_exchange_rate
    )
  );
end;
$function$;

revoke execute on function public.create_bank_transfer(uuid, uuid, uuid, numeric, date, text, numeric) from public, anon;
grant execute on function public.create_bank_transfer(uuid, uuid, uuid, numeric, date, text, numeric) to authenticated, service_role;
