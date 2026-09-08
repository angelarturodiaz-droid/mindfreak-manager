-- F11: Función transaccional para registrar un cobro de cliente.
-- Ver F0-Arquitectura, sección H (funciones SECURITY DEFINER para operaciones
-- financieras multi-tabla) y sección 15 del prompt maestro (flujo de cobro).
--
-- Al ser SECURITY DEFINER, esta función bypassa RLS en sus escrituras internas
-- (corre con privilegios de su dueño) — por eso valida el permiso
-- 'payments.create' explícitamente al inicio, y verifica que la factura
-- pertenezca a la compañía indicada, como defensa adicional.
--
-- Todo el cuerpo de la función es una única transacción implícita: si
-- cualquier paso falla, TODO se revierte (rollback automático de Postgres).

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
  v_new_paid numeric;
  v_new_balance numeric;
  v_new_status text;
  v_user_id uuid := auth.uid();
begin
  if not public.has_permission('payments.create') then
    raise exception 'insufficient_privilege: falta el permiso payments.create';
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

  -- 1) Crear el pago
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

  -- 2) Actualizar balance/estado de la factura
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

  -- 3) Movimiento bancario, si el cobro se asoció a una cuenta
  if p_bank_account_id is not null then
    insert into public.bank_transactions (
      company_id, bank_account_id, project_id, client_id, customer_payment_id,
      type, amount, currency, exchange_rate, transaction_date, description
    ) values (
      p_company_id, p_bank_account_id, p_project_id, p_client_id, v_payment_id,
      'INCOME', p_amount, p_currency, p_exchange_rate, p_payment_date,
      'Cobro factura ' || v_invoice.number
    );
  end if;

  -- 4) Auditoría
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

revoke execute on function public.register_customer_payment(
  uuid, uuid, uuid, uuid, uuid, date, numeric, text, text, text, numeric, text
) from public, anon;
