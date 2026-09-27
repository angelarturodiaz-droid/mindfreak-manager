-- 1) Categoría en el formulario de cobros.
--    register_customer_payment recibe un parámetro nuevo opcional
--    p_category_id. Si viene, el movimiento de banco del cobro se guarda con
--    esa categoría; si no viene (null), el trigger de 059 pone
--    "Cobro de factura" igual que antes. Todo lo demás de la función queda
--    idéntico. Como cambia la firma, se elimina la versión de 12 parámetros
--    y se vuelven a dar los mismos permisos (authenticated y service_role;
--    nunca anon). El parámetro tiene default, así que una llamada sin
--    p_category_id sigue funcionando.
--
-- 2) Factura "enviada al cliente": marca informativa (fecha y usuario) en
--    facturas ya emitidas. No cambia el estado de la factura.
--
-- Idempotente: se puede correr más de una vez.

alter table public.invoices
  add column if not exists sent_to_client_at timestamptz,
  add column if not exists sent_to_client_by uuid references public.profiles (id) on delete set null;

drop function if exists public.register_customer_payment(uuid, uuid, uuid, uuid, uuid, date, numeric, text, text, text, numeric, text);

CREATE OR REPLACE FUNCTION public.register_customer_payment(p_company_id uuid, p_client_id uuid, p_invoice_id uuid, p_project_id uuid, p_bank_account_id uuid, p_payment_date date, p_amount numeric, p_method text, p_reference text, p_currency text, p_exchange_rate numeric, p_notes text, p_category_id uuid DEFAULT NULL::uuid)
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

  if p_category_id is not null and not exists (
    select 1 from public.expense_categories
    where id = p_category_id and company_id = p_company_id
  ) then
    raise exception 'category_not_found: la categoría no existe o no pertenece a esta compañía';
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

  -- category_id null -> el trigger asigna "Cobro de factura"
  insert into public.bank_transactions (
    company_id, bank_account_id, project_id, client_id, customer_payment_id,
    type, amount, currency, exchange_rate, transaction_date, description,
    category_id
  ) values (
    p_company_id, p_bank_account_id, p_project_id, p_client_id, v_payment_id,
    'INCOME', p_amount, p_currency, p_exchange_rate, p_payment_date,
    'Cobro factura ' || v_invoice.number,
    p_category_id
  );

  insert into public.audit_logs (company_id, user_id, action, entity_type, entity_id, new_values)
  values (
    p_company_id, v_user_id, 'CREATE', 'customer_payment', v_payment_id,
    jsonb_build_object(
      'invoice_id', p_invoice_id, 'amount', p_amount, 'method', p_method,
      'new_invoice_status', v_new_status, 'category_id', p_category_id
    )
  );

  return v_payment_id;
end;
$function$;

revoke execute on function public.register_customer_payment(uuid, uuid, uuid, uuid, uuid, date, numeric, text, text, text, numeric, text, uuid) from public, anon;
grant execute on function public.register_customer_payment(uuid, uuid, uuid, uuid, uuid, date, numeric, text, text, text, numeric, text, uuid) to authenticated, service_role;
