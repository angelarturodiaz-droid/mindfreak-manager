-- Reconstruida desde producción (supabase_migrations.schema_migrations,
-- versión 20260923022350 "add_company_ownership_check_to_financial_rpcs").
-- Se aplicó directo en Supabase el 2026-09-23 sin comitear el archivo; se
-- agrega al repo para que una base nueva montada desde supabase/migrations/
-- quede idéntica a producción. Idempotente (create or replace): correrla
-- de nuevo en producción no cambia nada.
--
-- Refuerzo de seguridad: las funciones financieras SECURITY DEFINER son
-- invocables directo vía /rest/v1/rpc/<nombre> por cualquier usuario
-- autenticado. Ya validan el permiso (has_permission) y que las entidades
-- referenciadas pertenezcan a p_company_id, pero no validaban que
-- p_company_id fuera una compañía del usuario que llama. Se agrega ese
-- chequeo. Sin efecto práctico hoy (una sola compañía activa) — es
-- preparación para cuando se active multiempresa.

CREATE OR REPLACE FUNCTION public.register_customer_payment(p_company_id uuid, p_client_id uuid, p_invoice_id uuid, p_project_id uuid, p_bank_account_id uuid, p_payment_date date, p_amount numeric, p_method text, p_reference text, p_currency text, p_exchange_rate numeric, p_notes text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  if p_company_id not in (select * from public.user_company_ids()) then
    raise exception 'company_mismatch: no tienes acceso a esta compañía';
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
$function$;

CREATE OR REPLACE FUNCTION public.register_supplier_payment(p_company_id uuid, p_supplier_id uuid, p_expense_id uuid, p_project_id uuid, p_bank_account_id uuid, p_payment_date date, p_amount numeric, p_method text, p_reference text, p_currency text, p_exchange_rate numeric, p_notes text, p_payee_bank_name text DEFAULT NULL::text)
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
      'new_expense_status', v_new_status, 'payee_bank_name', p_payee_bank_name
    )
  );

  return v_payment_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.create_bank_transfer(p_company_id uuid, p_from_account_id uuid, p_to_account_id uuid, p_amount numeric, p_transaction_date date, p_description text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_from record;
  v_to record;
  v_user_id uuid := auth.uid();
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
$function$;

CREATE OR REPLACE FUNCTION public.create_card_expense(p_company_id uuid, p_category_id uuid, p_supplier_id uuid, p_project_id uuid, p_card_account_id uuid, p_expense_date date, p_description text, p_subtotal numeric, p_tax numeric, p_total numeric, p_currency text, p_exchange_rate numeric, p_payment_method text DEFAULT 'CARD'::text, p_payee_bank_name text DEFAULT NULL::text)
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
    type, amount, currency, exchange_rate, transaction_date, description
  ) values (
    p_company_id, p_card_account_id, p_project_id, p_supplier_id, v_expense_id, v_payment_id,
    'EXPENSE', p_total, p_currency, p_exchange_rate, p_expense_date,
    case when v_account.type = 'CREDIT_CARD' then 'Compra con tarjeta: ' else 'Gasto pagado: ' end
      || p_description
  );

  insert into public.audit_logs (company_id, user_id, action, entity_type, entity_id, new_values)
  values (
    p_company_id, v_user_id, 'CREATE', 'expense', v_expense_id,
    jsonb_build_object(
      'description', p_description, 'total', p_total,
      'account_id', p_card_account_id, 'account_type', v_account.type,
      'payment_method', p_payment_method, 'payee_bank_name', p_payee_bank_name
    )
  );

  return v_expense_id;
end;
$function$;
