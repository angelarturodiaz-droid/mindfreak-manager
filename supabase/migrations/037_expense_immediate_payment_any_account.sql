-- Generaliza create_card_expense: ahora acepta tanto bancos como tarjetas.
-- Motivo: al crear un gasto, si el usuario YA sabe desde qué banco se pagó
-- (ej. transferencia ya hecha), quiere que quede registrado de una vez como
-- pagado, igual que ya pasa con tarjeta — en vez de crearlo pendiente y
-- tener que ir después a "Registrar pago" a elegir el mismo banco.
-- Si no se indica cuenta al crear, el gasto sigue naciendo PENDING como
-- siempre (el flujo Gasto→Pago→Banco de dos pasos sigue disponible).

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
  p_payment_method text default 'CARD'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expense_id uuid;
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
    payment_method, status, currency, exchange_rate, created_by
  ) values (
    p_company_id, p_category_id, p_supplier_id, p_project_id, p_card_account_id,
    p_expense_date, p_description, p_subtotal, p_tax, p_total, p_total, 0,
    p_payment_method, 'PAID', p_currency, p_exchange_rate, v_user_id
  )
  returning id into v_expense_id;

  insert into public.bank_transactions (
    company_id, bank_account_id, project_id, supplier_id, expense_id,
    type, amount, currency, exchange_rate, transaction_date, description
  ) values (
    p_company_id, p_card_account_id, p_project_id, p_supplier_id, v_expense_id,
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
      'payment_method', p_payment_method
    )
  );

  return v_expense_id;
end;
$$;
