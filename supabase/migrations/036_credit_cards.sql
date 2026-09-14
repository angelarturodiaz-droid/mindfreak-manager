-- Ronda 2 de la nueva lógica financiera: Tarjetas de crédito.
--
-- Diseño: una tarjeta es una fila más de bank_accounts (columna `type`),
-- reutilizando TODA la infraestructura ya probada de Bancos — RLS, vista
-- de balance, transferencias — en vez de una tabla paralela.
--
-- Convención: para una tarjeta, el "balance" calculado por
-- bank_account_balances representa deuda EN NEGATIVO (ej. -5,000 significa
-- que se deben 5,000). Esto funciona con la fórmula existente SIN
-- modificarla:
--   - Una compra con tarjeta se inserta como bank_transactions.type='EXPENSE'
--     -> resta del balance -> el balance se vuelve más negativo -> más deuda.
--   - Un pago a la tarjeta se hace vía create_bank_transfer (ya existente)
--     -> se inserta como TRANSFER positivo en la cuenta destino -> el
--     balance sube hacia cero -> baja la deuda.
-- La UI es quien decide mostrar "Deuda actual" = -balance en vez de
-- "Saldo actual" cuando type = 'CREDIT_CARD'.

alter table public.bank_accounts
  add column if not exists type text not null default 'BANK' check (type in ('BANK', 'CREDIT_CARD')),
  add column if not exists credit_limit numeric(14, 2);

-- Un cobro de cliente no puede recibirse directamente en una tarjeta de
-- crédito (no tiene sentido: el dinero de un cliente entra a un banco).
create or replace function public.register_customer_payment(
  p_company_id uuid,
  p_client_id uuid,
  p_invoice_id uuid,
  p_project_id uuid,
  p_bank_account_id uuid,
  p_payment_date date,
  p_amount numeric,
  p_method text,
  p_reference text,
  p_currency text,
  p_exchange_rate numeric,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment_id uuid;
  v_invoice record;
  v_bank_account record;
  v_new_paid numeric;
  v_new_balance numeric;
  v_new_status text;
  v_user_id uuid := auth.uid();
begin
  if not public.has_permission('payments.create') then
    raise exception 'insufficient_privilege: falta el permiso payments.create';
  end if;

  if p_bank_account_id is null then
    raise exception 'bank_account_required: debes elegir la cuenta bancaria donde se recibió el cobro';
  end if;

  select * into v_invoice from public.invoices where id = p_invoice_id for update;
  if not found then
    raise exception 'invoice_not_found: la factura % no existe', p_invoice_id;
  end if;
  if v_invoice.company_id <> p_company_id then
    raise exception 'company_mismatch: la factura no pertenece a esta compañía';
  end if;
  if v_invoice.status not in ('ISSUED', 'PARTIALLY_PAID', 'OVERDUE') then
    raise exception 'invalid_status: solo se puede cobrar una factura emitida (estado actual: %)', v_invoice.status;
  end if;
  if p_amount <= 0 then
    raise exception 'invalid_amount: el monto debe ser mayor a 0';
  end if;
  if p_amount > v_invoice.balance then
    raise exception 'amount_exceeds_balance: el monto (%) supera el balance pendiente (%)', p_amount, v_invoice.balance;
  end if;

  select * into v_bank_account from public.bank_accounts where id = p_bank_account_id;
  if not found or v_bank_account.company_id <> p_company_id then
    raise exception 'account_not_found: la cuenta bancaria no existe o no pertenece a esta compañía';
  end if;
  if v_bank_account.type = 'CREDIT_CARD' then
    raise exception 'invalid_account_type: no se puede recibir un cobro de cliente en una tarjeta de crédito';
  end if;

  insert into public.customer_payments (
    company_id, client_id, invoice_id, project_id, bank_account_id,
    payment_date, amount, method, reference, currency, exchange_rate, notes,
    created_by
  ) values (
    p_company_id, p_client_id, p_invoice_id, p_project_id, p_bank_account_id,
    p_payment_date, p_amount, p_method, p_reference, p_currency, p_exchange_rate, p_notes,
    v_user_id
  )
  returning id into v_payment_id;

  v_new_paid := v_invoice.paid_amount + p_amount;
  v_new_balance := v_invoice.total - v_new_paid;
  v_new_status := case
    when v_new_balance <= 0 then 'PAID'
    else 'PARTIALLY_PAID'
  end;

  update public.invoices
  set paid_amount = v_new_paid,
      balance = greatest(0, v_new_balance),
      status = v_new_status
  where id = p_invoice_id;

  insert into public.bank_transactions (
    company_id, bank_account_id, project_id, client_id, customer_payment_id,
    type, amount, currency, exchange_rate, transaction_date, description
  ) values (
    p_company_id, p_bank_account_id, p_project_id, p_client_id, v_payment_id,
    'INCOME', p_amount, p_currency, p_exchange_rate, p_payment_date,
    'Cobro factura ' || v_invoice.number
  );

  insert into public.audit_logs (company_id, user_id, action, entity_type, entity_id, new_values)
  values (
    p_company_id, v_user_id, 'CREATE', 'customer_payment', v_payment_id,
    jsonb_build_object(
      'invoice_id', p_invoice_id, 'amount', p_amount, 'method', p_method,
      'new_invoice_status', v_new_status
    )
  );

  return v_payment_id;
end;
$$;

-- Un pago a proveedor (de un gasto ya pendiente) tampoco puede salir de
-- una tarjeta — el flujo con tarjeta va por create_card_expense (el gasto
-- nace ya pagado), no por este camino de "pagar un gasto pendiente".
create or replace function public.register_supplier_payment(
  p_company_id uuid,
  p_supplier_id uuid,
  p_expense_id uuid,
  p_project_id uuid,
  p_bank_account_id uuid,
  p_payment_date date,
  p_amount numeric,
  p_method text,
  p_reference text,
  p_currency text,
  p_exchange_rate numeric,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
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
    created_by
  ) values (
    p_company_id, p_supplier_id, p_expense_id, p_project_id, p_bank_account_id,
    p_payment_date, p_amount, p_method, p_reference, p_currency, p_exchange_rate, p_notes,
    v_user_id
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
    type, amount, currency, exchange_rate, transaction_date, description
  ) values (
    p_company_id, p_bank_account_id, p_project_id, p_supplier_id, v_payment_id,
    'EXPENSE', p_amount, p_currency, p_exchange_rate, p_payment_date,
    'Pago a proveedor — gasto: ' || v_expense.description
  );

  insert into public.audit_logs (company_id, user_id, action, entity_type, entity_id, new_values)
  values (
    p_company_id, v_user_id, 'CREATE', 'supplier_payment', v_payment_id,
    jsonb_build_object(
      'expense_id', p_expense_id, 'amount', p_amount, 'method', p_method,
      'new_expense_status', v_new_status
    )
  );

  return v_payment_id;
end;
$$;

-- Nueva función: gasto pagado con tarjeta. Se crea YA PAGADO (no hay paso
-- de "pagar" después — la compra y el cargo a la tarjeta ocurren en el
-- mismo momento) y genera su bank_transaction contra la tarjeta de forma
-- atómica. Intereses/comisiones de tarjeta usan esta misma función (son
-- un gasto más pagado con esa tarjeta).
create or replace function public.create_card_expense(
  p_company_id uuid,
  p_category_id uuid,
  p_supplier_id uuid,
  p_project_id uuid,
  p_card_account_id uuid,
  p_expense_date date,
  p_description text,
  p_subtotal numeric,
  p_tax numeric,
  p_total numeric,
  p_currency text,
  p_exchange_rate numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expense_id uuid;
  v_card record;
  v_user_id uuid := auth.uid();
begin
  if not public.has_permission('expenses.create') then
    raise exception 'insufficient_privilege: falta el permiso expenses.create';
  end if;
  if p_total <= 0 then
    raise exception 'invalid_amount: el total debe ser mayor a 0';
  end if;

  select * into v_card from public.bank_accounts where id = p_card_account_id;
  if not found or v_card.company_id <> p_company_id then
    raise exception 'account_not_found: la tarjeta no existe o no pertenece a esta compañía';
  end if;
  if v_card.type <> 'CREDIT_CARD' then
    raise exception 'invalid_account_type: la cuenta seleccionada no es una tarjeta de crédito';
  end if;
  if not v_card.is_active then
    raise exception 'inactive_account: la tarjeta está inactiva';
  end if;

  insert into public.expenses (
    company_id, category_id, supplier_id, project_id, bank_account_id,
    expense_date, description, subtotal, tax, total, paid_amount, balance,
    payment_method, status, currency, exchange_rate, created_by
  ) values (
    p_company_id, p_category_id, p_supplier_id, p_project_id, p_card_account_id,
    p_expense_date, p_description, p_subtotal, p_tax, p_total, p_total, 0,
    'CARD', 'PAID', p_currency, p_exchange_rate, v_user_id
  )
  returning id into v_expense_id;

  insert into public.bank_transactions (
    company_id, bank_account_id, project_id, supplier_id, expense_id,
    type, amount, currency, exchange_rate, transaction_date, description
  ) values (
    p_company_id, p_card_account_id, p_project_id, p_supplier_id, v_expense_id,
    'EXPENSE', p_total, p_currency, p_exchange_rate, p_expense_date,
    'Compra con tarjeta: ' || p_description
  );

  insert into public.audit_logs (company_id, user_id, action, entity_type, entity_id, new_values)
  values (
    p_company_id, v_user_id, 'CREATE', 'expense', v_expense_id,
    jsonb_build_object(
      'description', p_description, 'total', p_total,
      'card_account_id', p_card_account_id, 'payment_method', 'CARD'
    )
  );

  return v_expense_id;
end;
$$;

revoke execute on function public.create_card_expense(
  uuid, uuid, uuid, uuid, uuid, date, text, numeric, numeric, numeric, text, numeric
) from public, anon;

-- Un gasto ya pagado (paid_amount > 0) no se puede cancelar sin más — eso
-- dejaría la deuda de la tarjeta (o el movimiento bancario) reflejando un
-- cargo que el estado del gasto ya no reconoce. Se necesitaría un flujo de
-- reembolso/nota de crédito para eso, que queda fuera de este alcance.
create or replace function public.guard_expense_cancel()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'CANCELLED' and old.status <> 'CANCELLED' and old.paid_amount > 0 then
    raise exception 'cannot_cancel_paid_expense: no se puede cancelar un gasto que ya tiene pagos registrados (paid_amount > 0) — requeriría un reembolso, no soportado todavía';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_expense_cancel_trigger on public.expenses;
create trigger guard_expense_cancel_trigger
  before update on public.expenses
  for each row
  execute function public.guard_expense_cancel();
