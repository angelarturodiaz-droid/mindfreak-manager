-- 074: Tratamiento fiscal — fases 5 y 6: resultado fiscal en el gasto y
-- pago por el NETO (ver claude/propuesta-tratamiento-fiscal.md).
--
-- * expenses: tipo de servicio, comprobante (tipo + NCF) y el "snapshot"
--   fiscal calculado al registrar el gasto (regla, versión, tasas, montos
--   retenidos, neto a pagar, explicación). Si después cambia una regla, el
--   gasto no cambia.
-- * Gastos existentes: NOT_EVALUATED, retenido 0 y net_payable = total →
--   saldos, pagos y bancos quedan IGUAL.
-- * register_supplier_payment: el saldo baja contra el neto
--   (coalesce(net_payable, total) − pagado). Sin retención es idéntico.
-- * create_card_expense (gasto pagado al crearlo): recibe el resultado
--   fiscal (p_fiscal) y paga el neto.
--
-- Idempotente.

alter table public.expenses
  add column if not exists service_type_id uuid references public.supplier_service_types (id) on delete set null,
  add column if not exists document_type text,
  add column if not exists ncf text,
  add column if not exists operation_type text check (operation_type in ('COMPRA_LOCAL', 'PAGO_EXTERIOR')),
  add column if not exists fiscal_status text not null default 'NOT_EVALUATED'
    check (fiscal_status in ('NOT_EVALUATED', 'NO_SUPPLIER', 'MISSING_DATA', 'NO_RULE', 'REVIEW', 'BLOCKED', 'NO_RETENTION', 'APPLIED', 'OVERRIDDEN')),
  add column if not exists fiscal_rule_id uuid references public.fiscal_rules (id) on delete set null,
  add column if not exists fiscal_rule_version integer,
  add column if not exists isr_rate numeric(5, 2) not null default 0,
  add column if not exists isr_base_pct numeric(5, 2) not null default 100,
  add column if not exists itbis_retention_pct numeric(5, 2) not null default 0,
  add column if not exists isr_withheld numeric(14, 2) not null default 0 check (isr_withheld >= 0),
  add column if not exists itbis_withheld numeric(14, 2) not null default 0 check (itbis_withheld >= 0),
  add column if not exists total_withheld numeric(14, 2) not null default 0 check (total_withheld >= 0),
  add column if not exists net_payable numeric(14, 2) check (net_payable >= 0),
  add column if not exists fiscal_evaluated_at timestamptz,
  add column if not exists fiscal_snapshot jsonb,
  add column if not exists fiscal_override_reason text,
  add column if not exists fiscal_overridden_by uuid references public.profiles (id) on delete set null,
  add column if not exists fiscal_overridden_at timestamptz;

update public.expenses set net_payable = total where net_payable is null;

create index if not exists idx_expenses_fiscal_rule on public.expenses (fiscal_rule_id);
create index if not exists idx_expenses_fiscal_status on public.expenses (company_id, fiscal_status);
create index if not exists idx_expenses_service_type on public.expenses (service_type_id);

-- ───────────── Pago a proveedor: contra el neto ─────────────
create or replace function public.register_supplier_payment(p_company_id uuid, p_supplier_id uuid, p_expense_id uuid, p_project_id uuid, p_bank_account_id uuid, p_payment_date date, p_amount numeric, p_method text, p_reference text, p_currency text, p_exchange_rate numeric, p_notes text, p_payee_bank_name text DEFAULT NULL::text, p_confirm_overdraft boolean DEFAULT false)
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
    raise exception 'amount_exceeds_balance: el monto (%) supera lo pendiente por pagarle al proveedor (%)', p_amount, v_expense.balance;
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
  -- Con retenciones el proveedor recibe el neto; sin retención net_payable = total.
  v_new_balance := coalesce(v_expense.net_payable, v_expense.total) - v_new_paid;
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
      'overdraft_confirmed', coalesce(p_confirm_overdraft, false),
      'net_payable', coalesce(v_expense.net_payable, v_expense.total),
      'total_withheld', v_expense.total_withheld
    )
  );

  return v_payment_id;
end;
$function$;

-- ───────────── Gasto pagado al crearlo: paga el neto ─────────────
drop function if exists public.create_card_expense(uuid, uuid, uuid, uuid, uuid, date, text, numeric, numeric, numeric, text, numeric, text, text, boolean);

create or replace function public.create_card_expense(p_company_id uuid, p_category_id uuid, p_supplier_id uuid, p_project_id uuid, p_card_account_id uuid, p_expense_date date, p_description text, p_subtotal numeric, p_tax numeric, p_total numeric, p_currency text, p_exchange_rate numeric, p_payment_method text DEFAULT 'CARD'::text, p_payee_bank_name text DEFAULT NULL::text, p_confirm_overdraft boolean DEFAULT false, p_fiscal jsonb DEFAULT NULL)
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
  v_net numeric;
  v_withheld numeric;
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

  v_withheld := coalesce((p_fiscal->>'total_withheld')::numeric, 0);
  v_net := coalesce((p_fiscal->>'net_payable')::numeric, p_total);
  if v_withheld < 0 or v_net < 0 or v_net > p_total or abs((p_total - v_withheld) - v_net) > 0.01 then
    raise exception 'invalid_fiscal: el neto a pagar no cuadra con el total y las retenciones';
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
    payment_method, status, currency, exchange_rate, payee_bank_name, created_by,
    service_type_id, document_type, ncf, operation_type, fiscal_status, fiscal_rule_id,
    fiscal_rule_version, isr_rate, isr_base_pct, itbis_retention_pct, isr_withheld,
    itbis_withheld, total_withheld, net_payable, fiscal_evaluated_at, fiscal_snapshot
  ) values (
    p_company_id, p_category_id, p_supplier_id, p_project_id, p_card_account_id,
    p_expense_date, p_description, p_subtotal, p_tax, p_total, v_net, 0,
    p_payment_method, 'PAID', p_currency, p_exchange_rate, p_payee_bank_name, v_user_id,
    nullif(p_fiscal->>'service_type_id', '')::uuid,
    nullif(p_fiscal->>'document_type', ''),
    nullif(p_fiscal->>'ncf', ''),
    nullif(p_fiscal->>'operation_type', ''),
    coalesce(nullif(p_fiscal->>'fiscal_status', ''), 'NOT_EVALUATED'),
    nullif(p_fiscal->>'fiscal_rule_id', '')::uuid,
    nullif(p_fiscal->>'fiscal_rule_version', '')::integer,
    coalesce((p_fiscal->>'isr_rate')::numeric, 0),
    coalesce((p_fiscal->>'isr_base_pct')::numeric, 100),
    coalesce((p_fiscal->>'itbis_retention_pct')::numeric, 0),
    coalesce((p_fiscal->>'isr_withheld')::numeric, 0),
    coalesce((p_fiscal->>'itbis_withheld')::numeric, 0),
    v_withheld,
    v_net,
    case when p_fiscal is null then null else now() end,
    p_fiscal->'snapshot'
  )
  returning id into v_expense_id;

  -- Si todo se retuvo (neto 0) no sale dinero hacia el proveedor.
  if v_net > 0 then
    if p_supplier_id is not null then
      insert into public.supplier_payments (
        company_id, supplier_id, expense_id, project_id, bank_account_id,
        payment_date, amount, method, currency, exchange_rate,
        payee_bank_name, created_by
      ) values (
        p_company_id, p_supplier_id, v_expense_id, p_project_id, p_card_account_id,
        p_expense_date, v_net, p_payment_method, p_currency, p_exchange_rate,
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
      'EXPENSE', v_net, p_currency, p_exchange_rate, p_expense_date,
      case when v_account.type = 'CREDIT_CARD' then 'Compra con tarjeta: ' else 'Gasto pagado: ' end
        || p_description,
      coalesce(p_confirm_overdraft, false)
    );
  end if;

  insert into public.audit_logs (company_id, user_id, action, entity_type, entity_id, new_values)
  values (
    p_company_id, v_user_id, 'CREATE', 'expense', v_expense_id,
    jsonb_build_object(
      'description', p_description, 'total', p_total, 'net_payable', v_net,
      'total_withheld', v_withheld, 'fiscal_status', p_fiscal->>'fiscal_status',
      'account_id', p_card_account_id, 'account_type', v_account.type,
      'payment_method', p_payment_method, 'payee_bank_name', p_payee_bank_name,
      'overdraft_confirmed', coalesce(p_confirm_overdraft, false)
    )
  );

  return v_expense_id;
end;
$function$;

revoke all on function public.create_card_expense(uuid, uuid, uuid, uuid, uuid, date, text, numeric, numeric, numeric, text, numeric, text, text, boolean, jsonb) from public, anon;
grant execute on function public.create_card_expense(uuid, uuid, uuid, uuid, uuid, date, text, numeric, numeric, numeric, text, numeric, text, text, boolean, jsonb) to authenticated, service_role;
