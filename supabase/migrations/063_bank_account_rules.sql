-- Reglas financieras por tipo de cuenta (diseño acordado con el usuario
-- el 2026-09-27). Solo tres tipos: Ahorro, Corriente y Tarjeta de crédito
-- (no se maneja Caja/Efectivo).
--
-- * Ahorro: nunca puede quedar en negativo. Una salida que supere el saldo
--   se bloquea ("Fondos insuficientes").
-- * Corriente sin sobregiro (valor por defecto): igual que ahorro.
-- * Corriente con sobregiro autorizado (allow_overdraft): puede quedar en
--   negativo, pero solo si el usuario lo confirma explícitamente
--   (bank_transactions.overdraft_confirmed = true). Sin confirmación la base
--   de datos devuelve "overdraft_confirmation_required" con el mensaje para
--   mostrar y la pantalla pide Continuar / Cancelar.
-- * Cuenta bancaria sin tipo (cuentas creadas antes de 061): se trata como
--   corriente sin sobregiro hasta que se le asigne un tipo.
-- * Tarjeta de crédito: el saldo guardado sigue siendo uno solo
--   (negativo = deuda, positivo = saldo a favor; nunca se muestra "deuda
--   negativa"). Una compra/salida no puede superar el crédito disponible:
--     disponible = límite − deuda                 (por defecto)
--     disponible = límite − deuda + saldo a favor (si favor_increases_limit)
--   Los pagos/entradas a la tarjeta nunca se bloquean: el excedente sobre la
--   deuda queda como saldo a favor. Sin límite configurado no se valida.
--
-- La validación vive en un trigger BEFORE INSERT de bank_transactions, así
-- aplica a TODOS los caminos (transferencias, pagos a proveedor, gastos
-- pagados al crear, movimientos manuales, llamadas directas a la API). El
-- trigger bloquea la fila de la cuenta (FOR UPDATE) para que dos
-- operaciones simultáneas no pasen con el mismo saldo. Si la validación
-- falla dentro de una transferencia, se revierte completa (las dos filas),
-- porque todo ocurre en la misma transacción.
--
-- Las funciones create_bank_transfer, register_supplier_payment y
-- create_card_expense reciben p_confirm_overdraft (default false) para
-- marcar la confirmación del usuario. Se reemplazan las versiones
-- anteriores con los mismos permisos (authenticated y service_role).
--
-- Idempotente. Probada en una base local (13 casos: ahorro, corriente
-- con/sin sobregiro, sin tipo, tarjeta con deuda, saldo a favor, límite).

alter table public.bank_accounts
  add column if not exists allow_overdraft boolean not null default false,
  add column if not exists favor_increases_limit boolean not null default false;

alter table public.bank_accounts drop constraint if exists bank_accounts_overdraft_only_checking;
alter table public.bank_accounts
  add constraint bank_accounts_overdraft_only_checking
  check (not allow_overdraft or (type = 'BANK' and account_kind = 'CHECKING'));

alter table public.bank_accounts drop constraint if exists bank_accounts_favor_limit_only_cards;
alter table public.bank_accounts
  add constraint bank_accounts_favor_limit_only_cards
  check (not favor_increases_limit or type = 'CREDIT_CARD');

alter table public.bank_transactions
  add column if not exists overdraft_confirmed boolean not null default false;

-- Formato de dinero para los mensajes: "RD$10,000.00" / "US$100.00"
create or replace function public.format_money_text(p_amount numeric, p_currency text)
returns text
language sql
immutable
set search_path = public
as $$
  select case when p_amount < 0 then '-' else '' end
    || case p_currency when 'DOP' then 'RD$' when 'USD' then 'US$' else coalesce(p_currency, '') || ' ' end
    || to_char(abs(coalesce(p_amount, 0)), 'FM999,999,999,990.00');
$$;

revoke execute on function public.format_money_text(numeric, text) from public, anon;
grant execute on function public.format_money_text(numeric, text) to authenticated, service_role;

-- Validación de fondos / crédito antes de registrar un movimiento.
-- Entradas (ingresos, transferencias recibidas, pagos a tarjeta) nunca se
-- bloquean.
create or replace function public.check_bank_transaction_funds()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account record;
  v_effect numeric;
  v_balance numeric;
  v_new_balance numeric;
  v_needed numeric;
  v_debt numeric;
  v_favor numeric;
  v_available numeric;
begin
  v_effect := case new.type
    when 'INCOME' then new.amount
    when 'EXPENSE' then -new.amount
    when 'TRANSFER' then new.amount
    else 0
  end;

  if v_effect >= 0 then
    return new;
  end if;
  v_needed := -v_effect;

  select * into v_account from public.bank_accounts where id = new.bank_account_id for update;
  if not found then
    return new;
  end if;

  select a.opening_balance + coalesce(sum(
    case t.type
      when 'INCOME' then t.amount
      when 'EXPENSE' then -t.amount
      when 'TRANSFER' then t.amount
      else 0
    end), 0)
  into v_balance
  from public.bank_accounts a
  left join public.bank_transactions t on t.bank_account_id = a.id
  where a.id = new.bank_account_id
  group by a.opening_balance;

  v_new_balance := v_balance + v_effect;

  if v_account.type = 'CREDIT_CARD' then
    if v_account.credit_limit is null or v_account.credit_limit <= 0 then
      return new;
    end if;
    v_debt := greatest(0, -v_balance);
    v_favor := greatest(0, v_balance);
    v_available := v_account.credit_limit - v_debt
      + case when v_account.favor_increases_limit then v_favor else 0 end;
    if v_needed > v_available then
      raise exception 'credit_insufficient: Crédito insuficiente. La operación de % supera el crédito disponible de % en la tarjeta «%».',
        public.format_money_text(v_needed, v_account.currency),
        public.format_money_text(greatest(0, v_available), v_account.currency),
        v_account.name;
    end if;
    return new;
  end if;

  if v_new_balance >= 0 then
    return new;
  end if;

  if v_account.account_kind = 'SAVINGS' then
    raise exception 'insufficient_funds: Fondos insuficientes. La cuenta de ahorro «%» tiene un saldo disponible de % y la operación requiere %. Las cuentas de ahorro no permiten sobregiros.',
      v_account.name,
      public.format_money_text(v_balance, v_account.currency),
      public.format_money_text(v_needed, v_account.currency);
  end if;

  if v_account.account_kind = 'CHECKING' and v_account.allow_overdraft then
    if not new.overdraft_confirmed then
      raise exception 'overdraft_confirmation_required: Fondos insuficientes. La cuenta corriente «%» tiene un saldo disponible de % y esta operación generará un sobregiro de %. ¿Desea continuar?',
        v_account.name,
        public.format_money_text(v_balance, v_account.currency),
        public.format_money_text(-v_new_balance, v_account.currency);
    end if;
    return new;
  end if;

  if v_account.account_kind = 'CHECKING' then
    raise exception 'insufficient_funds: Fondos insuficientes. La cuenta corriente «%» tiene un saldo disponible de % y la operación requiere %. La cuenta corriente no tiene sobregiro autorizado.',
      v_account.name,
      public.format_money_text(v_balance, v_account.currency),
      public.format_money_text(v_needed, v_account.currency);
  end if;

  raise exception 'insufficient_funds: Fondos insuficientes. La cuenta «%» tiene un saldo disponible de % y la operación requiere %. Esta cuenta todavía no tiene tipo asignado y se trata como corriente sin sobregiro: edítala en Bancos para indicar si es de ahorro o corriente (y si tiene sobregiro autorizado).',
    v_account.name,
    public.format_money_text(v_balance, v_account.currency),
    public.format_money_text(v_needed, v_account.currency);
end;
$$;

revoke execute on function public.check_bank_transaction_funds() from public, anon, authenticated;

drop trigger if exists trg_bank_transaction_check_funds on public.bank_transactions;
create trigger trg_bank_transaction_check_funds
  before insert on public.bank_transactions
  for each row
  execute function public.check_bank_transaction_funds();

-- Transferencias: igual que 060 + p_confirm_overdraft. La salida se valida
-- en el trigger; si falla no se registra ninguna de las dos filas.
drop function if exists public.create_bank_transfer(uuid, uuid, uuid, numeric, date, text, numeric);

CREATE OR REPLACE FUNCTION public.create_bank_transfer(p_company_id uuid, p_from_account_id uuid, p_to_account_id uuid, p_amount numeric, p_transaction_date date, p_description text, p_exchange_rate numeric DEFAULT NULL::numeric, p_confirm_overdraft boolean DEFAULT false)
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

  insert into public.audit_logs (company_id, user_id, action, entity_type, entity_id, new_values)
  values (
    p_company_id, v_user_id, 'CREATE', 'bank_transfer', p_from_account_id,
    jsonb_build_object(
      'to_account_id', p_to_account_id, 'amount', p_amount,
      'to_amount', v_to_amount, 'exchange_rate', p_exchange_rate,
      'overdraft_confirmed', coalesce(p_confirm_overdraft, false)
    )
  );
end;
$function$;

revoke execute on function public.create_bank_transfer(uuid, uuid, uuid, numeric, date, text, numeric, boolean) from public, anon;
grant execute on function public.create_bank_transfer(uuid, uuid, uuid, numeric, date, text, numeric, boolean) to authenticated, service_role;

-- Pago a proveedor: igual que antes + p_confirm_overdraft
drop function if exists public.register_supplier_payment(uuid, uuid, uuid, uuid, uuid, date, numeric, text, text, text, numeric, text, text);

CREATE OR REPLACE FUNCTION public.register_supplier_payment(p_company_id uuid, p_supplier_id uuid, p_expense_id uuid, p_project_id uuid, p_bank_account_id uuid, p_payment_date date, p_amount numeric, p_method text, p_reference text, p_currency text, p_exchange_rate numeric, p_notes text, p_payee_bank_name text DEFAULT NULL::text, p_confirm_overdraft boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_payment_id uuid;
  v_expense record;
  v_bank_account record;
  v_new_paid numeric;
  v_new_balance numeric;
  v_new_status text;
  v_user_id uuid := auth.uid();
begin
  if not public.has_permission('payments.create') then
    raise exception 'insufficient_privilege: falta el permiso payments.create';
  end if;

  if p_company_id not in (select * from public.user_company_ids()) then
    raise exception 'company_mismatch: no tienes acceso a esta compañía';
  end if;

  if p_bank_account_id is null then
    raise exception 'bank_account_required: debes elegir la cuenta bancaria desde donde se realizó el pago';
  end if;

  select * into v_expense from public.expenses where id = p_expense_id for update;
  if not found then
    raise exception 'expense_not_found: el gasto % no existe', p_expense_id;
  end if;
  if v_expense.company_id <> p_company_id then
    raise exception 'company_mismatch: el gasto no pertenece a esta compañía';
  end if;
  if v_expense.status not in ('PENDING', 'PARTIALLY_PAID') then
    raise exception 'invalid_status: solo se puede pagar un gasto pendiente (estado actual: %)', v_expense.status;
  end if;
  if p_amount <= 0 then
    raise exception 'invalid_amount: el monto debe ser mayor a 0';
  end if;
  if p_amount > v_expense.balance then
    raise exception 'amount_exceeds_balance: el monto (%) supera el balance pendiente (%)', p_amount, v_expense.balance;
  end if;

  select * into v_bank_account from public.bank_accounts where id = p_bank_account_id;
  if not found or v_bank_account.company_id <> p_company_id then
    raise exception 'account_not_found: la cuenta bancaria no existe o no pertenece a esta compañía';
  end if;
  if v_bank_account.type = 'CREDIT_CARD' then
    raise exception 'invalid_account_type: un gasto pagado con tarjeta se registra directo como tarjeta al crearlo, no como pago posterior';
  end if;

  insert into public.supplier_payments (
    company_id, supplier_id, expense_id, project_id, bank_account_id,
    payment_date, amount, method, reference, currency, exchange_rate, notes,
    payee_bank_name, created_by
  ) values (
    p_company_id, p_supplier_id, p_expense_id, p_project_id, p_bank_account_id,
    p_payment_date, p_amount, p_method, p_reference, p_currency, p_exchange_rate, p_notes,
    p_payee_bank_name, v_user_id
  )
  returning id into v_payment_id;

  v_new_paid := v_expense.paid_amount + p_amount;
  v_new_balance := v_expense.total - v_new_paid;
  v_new_status := case
    when v_new_balance <= 0 then 'PAID'
    else 'PARTIALLY_PAID'
  end;

  update public.expenses
  set paid_amount = v_new_paid,
      balance = greatest(0, v_new_balance),
      status = v_new_status
  where id = p_expense_id;

  insert into public.bank_transactions (
    company_id, bank_account_id, project_id, supplier_id, supplier_payment_id,
    type, amount, currency, exchange_rate, transaction_date, description,
    overdraft_confirmed
  ) values (
    p_company_id, p_bank_account_id, p_project_id, p_supplier_id, v_payment_id,
    'EXPENSE', p_amount, p_currency, p_exchange_rate, p_payment_date,
    'Pago a proveedor — gasto: ' || v_expense.description,
    coalesce(p_confirm_overdraft, false)
  );

  insert into public.audit_logs (company_id, user_id, action, entity_type, entity_id, new_values)
  values (
    p_company_id, v_user_id, 'CREATE', 'supplier_payment', v_payment_id,
    jsonb_build_object(
      'expense_id', p_expense_id, 'amount', p_amount, 'method', p_method,
      'new_expense_status', v_new_status, 'payee_bank_name', p_payee_bank_name,
      'overdraft_confirmed', coalesce(p_confirm_overdraft, false)
    )
  );

  return v_payment_id;
end;
$function$;

revoke execute on function public.register_supplier_payment(uuid, uuid, uuid, uuid, uuid, date, numeric, text, text, text, numeric, text, text, boolean) from public, anon;
grant execute on function public.register_supplier_payment(uuid, uuid, uuid, uuid, uuid, date, numeric, text, text, text, numeric, text, text, boolean) to authenticated, service_role;

-- Gasto pagado al crearlo (banco o tarjeta): igual que antes + p_confirm_overdraft
drop function if exists public.create_card_expense(uuid, uuid, uuid, uuid, uuid, date, text, numeric, numeric, numeric, text, numeric, text, text);

CREATE OR REPLACE FUNCTION public.create_card_expense(p_company_id uuid, p_category_id uuid, p_supplier_id uuid, p_project_id uuid, p_card_account_id uuid, p_expense_date date, p_description text, p_subtotal numeric, p_tax numeric, p_total numeric, p_currency text, p_exchange_rate numeric, p_payment_method text DEFAULT 'CARD'::text, p_payee_bank_name text DEFAULT NULL::text, p_confirm_overdraft boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_expense_id uuid;
  v_payment_id uuid;
  v_account record;
  v_user_id uuid := auth.uid();
begin
  if not public.has_permission('expenses.create') then
    raise exception 'insufficient_privilege: falta el permiso expenses.create';
  end if;

  if p_company_id not in (select * from public.user_company_ids()) then
    raise exception 'company_mismatch: no tienes acceso a esta compañía';
  end if;

  if p_total <= 0 then
    raise exception 'invalid_amount: el total debe ser mayor a 0';
  end if;

  select * into v_account from public.bank_accounts where id = p_card_account_id;
  if not found or v_account.company_id <> p_company_id then
    raise exception 'account_not_found: la cuenta no existe o no pertenece a esta compañía';
  end if;
  if not v_account.is_active then
    raise exception 'inactive_account: la cuenta está inactiva';
  end if;

  insert into public.expenses (
    company_id, category_id, supplier_id, project_id, bank_account_id,
    expense_date, description, subtotal, tax, total, paid_amount, balance,
    payment_method, status, currency, exchange_rate, payee_bank_name, created_by
  ) values (
    p_company_id, p_category_id, p_supplier_id, p_project_id, p_card_account_id,
    p_expense_date, p_description, p_subtotal, p_tax, p_total, p_total, 0,
    p_payment_method, 'PAID', p_currency, p_exchange_rate, p_payee_bank_name, v_user_id
  )
  returning id into v_expense_id;

  if p_supplier_id is not null then
    insert into public.supplier_payments (
      company_id, supplier_id, expense_id, project_id, bank_account_id,
      payment_date, amount, method, currency, exchange_rate,
      payee_bank_name, created_by
    ) values (
      p_company_id, p_supplier_id, v_expense_id, p_project_id, p_card_account_id,
      p_expense_date, p_total, p_payment_method, p_currency, p_exchange_rate,
      p_payee_bank_name, v_user_id
    )
    returning id into v_payment_id;
  end if;

  insert into public.bank_transactions (
    company_id, bank_account_id, project_id, supplier_id, expense_id, supplier_payment_id,
    type, amount, currency, exchange_rate, transaction_date, description,
    overdraft_confirmed
  ) values (
    p_company_id, p_card_account_id, p_project_id, p_supplier_id, v_expense_id, v_payment_id,
    'EXPENSE', p_total, p_currency, p_exchange_rate, p_expense_date,
    case when v_account.type = 'CREDIT_CARD' then 'Compra con tarjeta: ' else 'Gasto pagado: ' end
      || p_description,
    coalesce(p_confirm_overdraft, false)
  );

  insert into public.audit_logs (company_id, user_id, action, entity_type, entity_id, new_values)
  values (
    p_company_id, v_user_id, 'CREATE', 'expense', v_expense_id,
    jsonb_build_object(
      'description', p_description, 'total', p_total,
      'account_id', p_card_account_id, 'account_type', v_account.type,
      'payment_method', p_payment_method, 'payee_bank_name', p_payee_bank_name,
      'overdraft_confirmed', coalesce(p_confirm_overdraft, false)
    )
  );

  return v_expense_id;
end;
$function$;

revoke execute on function public.create_card_expense(uuid, uuid, uuid, uuid, uuid, date, text, numeric, numeric, numeric, text, numeric, text, text, boolean) from public, anon;
grant execute on function public.create_card_expense(uuid, uuid, uuid, uuid, uuid, date, text, numeric, numeric, numeric, text, numeric, text, text, boolean) to authenticated, service_role;
