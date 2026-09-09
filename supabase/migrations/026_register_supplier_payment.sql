-- F13: Función transaccional para registrar un pago a proveedor.
-- Mismo patrón que register_customer_payment (F11) — ver F0-Arquitectura,
-- sección H y sección 17 del prompt maestro (flujo de pago a proveedor).
-- SECURITY DEFINER: valida 'payments.create' explícitamente al inicio (el
-- mismo permiso cubre cobros y pagos a proveedores por diseño, ver 019_rls).

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
  v_new_paid numeric;
  v_new_balance numeric;
  v_new_status text;
  v_user_id uuid := auth.uid();
begin
  if not public.has_permission('payments.create') then
    raise exception 'insufficient_privilege: falta el permiso payments.create';
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

  -- 1) Crear el pago
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

  -- 2) Actualizar balance/estado del gasto
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

  -- 3) Movimiento bancario, si el pago se asoció a una cuenta
  if p_bank_account_id is not null then
    insert into public.bank_transactions (
      company_id, bank_account_id, project_id, supplier_id, supplier_payment_id,
      type, amount, currency, exchange_rate, transaction_date, description
    ) values (
      p_company_id, p_bank_account_id, p_project_id, p_supplier_id, v_payment_id,
      'EXPENSE', p_amount, p_currency, p_exchange_rate, p_payment_date,
      'Pago a proveedor — gasto: ' || v_expense.description
    );
  end if;

  -- 4) Auditoría
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

revoke execute on function public.register_supplier_payment(
  uuid, uuid, uuid, uuid, uuid, date, numeric, text, text, text, numeric, text
) from public, anon;
