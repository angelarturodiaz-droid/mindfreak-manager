-- Limpieza de compatibilidad: las migraciones 035→038 fueron agregando
-- parámetros nuevos a estas dos funciones con CREATE OR REPLACE, pero cada
-- vez que cambia la firma (número de parámetros), Postgres crea una
-- función SOBRECARGADA nueva en vez de reemplazar la anterior — dejaban
-- 2-3 versiones de la misma función conviviendo (detectado en este entorno
-- real, ya limpiado a mano; estos DROP hacen que una instalación nueva
-- desde cero termine igual de limpia).
drop function if exists public.register_supplier_payment(
  uuid, uuid, uuid, uuid, uuid, date, numeric, text, text, text, numeric, text
);
drop function if exists public.create_card_expense(
  uuid, uuid, uuid, uuid, uuid, date, text, numeric, numeric, numeric, text, numeric
);
drop function if exists public.create_card_expense(
  uuid, uuid, uuid, uuid, uuid, date, text, numeric, numeric, numeric, text, numeric, text
);

-- Gap encontrado al revisar: un gasto que nace YA PAGADO (tarjeta o banco
-- elegido al crear) nunca generaba su fila en supplier_payments — solo el
-- bank_transaction. Esto dejaba "Historial de pagos" vacío en el detalle
-- del gasto, aunque el gasto sí estuviera PAID. Se corrige generando
-- también el supplier_payment cuando hay proveedor, con el mismo
-- payee_bank_name.

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
  p_exchange_rate numeric,
  p_payment_method text default 'CARD',
  p_payee_bank_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expense_id uuid;
  v_payment_id uuid;
  v_account record;
  v_user_id uuid := auth.uid();
begin
  if not public.has_permission('expenses.create') then
    raise exception 'insufficient_privilege: falta el permiso expenses.create';
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
$$;
