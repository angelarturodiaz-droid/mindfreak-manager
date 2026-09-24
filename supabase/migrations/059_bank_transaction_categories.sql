-- Tipo + Categoría en los movimientos de banco.
--
-- Diseño acordado con el usuario (2026-09-23):
-- * Tipo (INCOME/EXPENSE/TRANSFER) y Categoría son independientes. Las
--   categorías NO tienen tipo: cualquiera se puede usar en ingresos o
--   egresos. Es el mismo catálogo que los gastos (Configuración >
--   Categorías, tabla expense_categories).
-- * Todo movimiento debe tener Tipo; la Categoría se asigna sola según el
--   origen, se elige en los manuales y puede quedar "Sin categoría"
--   (category_id null) temporalmente, visible como alerta para corregirla.
-- * Categoría automática según el origen:
--     cobro de factura            -> "Cobro de factura"
--     pago a proveedor / gasto    -> la categoría del gasto asociado
--                                    (si no tiene: "Pago a suplidor" u
--                                    "Otros gastos")
--     transferencia con tarjeta   -> "Pago de tarjeta de crédito"
--     otra transferencia          -> "Transferencia entre cuentas"
-- * Transferencias enlazadas: las dos filas comparten transfer_group_id y
--   cada una guarda la cuenta de contraparte.
-- * Referencia opcional (número de cheque / transacción).
--
-- Idempotente: se puede correr más de una vez sin duplicar nada.

-- 1) Columnas nuevas
alter table public.bank_transactions
  add column if not exists category_id uuid references public.expense_categories (id) on delete set null,
  add column if not exists transfer_group_id uuid,
  add column if not exists counterpart_account_id uuid references public.bank_accounts (id) on delete set null,
  add column if not exists reference text;

create index if not exists idx_bank_transactions_category on public.bank_transactions (category_id);
create index if not exists idx_bank_transactions_transfer_group on public.bank_transactions (transfer_group_id);

-- 2) Lista inicial de categorías (sin duplicar por nombre, ignorando
--    mayúsculas y acentos)
with seed(name, description) as (
  values
    ('Ventas', 'Ingresos por venta de productos o eventos'),
    ('Servicios', 'Ingresos o pagos por servicios'),
    ('Cobro de factura', 'Cobros a clientes por facturas emitidas'),
    ('Anticipo de cliente', 'Adelantos recibidos antes de facturar'),
    ('Comisión', 'Comisiones cobradas o pagadas'),
    ('Reembolso', 'Devoluciones de dinero recibidas o hechas'),
    ('Otros ingresos', 'Ingresos que no encajan en otra categoría'),
    ('Pago a suplidor', 'Pagos a proveedores cuando el gasto no tiene categoría'),
    ('Nómina', 'Salarios, bonos y pagos al personal'),
    ('Honorarios profesionales', 'Contadores, abogados, consultores'),
    ('Gastos de representación', 'Comidas, atenciones y gastos con clientes'),
    ('Gastos administrativos', 'Papelería, oficina y gastos generales'),
    ('Alquiler', 'Alquiler de local, almacén u oficina'),
    ('Alquiler de equipos', 'Sonido, luces, tarimas, mobiliario'),
    ('Catering y alimentos', 'Comida y bebida para eventos'),
    ('Transporte y combustible', 'Traslados, fletes y combustible'),
    ('Publicidad y mercadeo', 'Anuncios, redes sociales, material promocional'),
    ('Servicios públicos', 'Luz, agua, teléfono e internet'),
    ('Mantenimiento y reparaciones', 'Arreglos de equipos, vehículos o local'),
    ('Seguros', 'Pólizas y seguros'),
    ('Impuestos', 'ITBIS, ISR, anticipos y otros impuestos'),
    ('Comisiones bancarias', 'Cargos y comisiones del banco'),
    ('Intereses bancarios', 'Intereses ganados o pagados'),
    ('Pago de tarjeta de crédito', 'Pagos hechos a tarjetas de crédito'),
    ('Transferencia entre cuentas', 'Movimientos entre cuentas propias'),
    ('Préstamos', 'Desembolsos y pagos de préstamos'),
    ('Otros gastos', 'Egresos que no encajan en otra categoría')
)
insert into public.expense_categories (company_id, name, description)
select c.id, s.name, s.description
from public.companies c
cross join seed s
where not exists (
  select 1
  from public.expense_categories ec
  where ec.company_id = c.id
    and lower(translate(ec.name, 'áéíóúÁÉÍÓÚ', 'aeiouAEIOU')) = lower(translate(s.name, 'áéíóúÁÉÍÓÚ', 'aeiouAEIOU'))
);

-- 3) Buscar una categoría de la compañía por nombre (sin mayúsculas/acentos)
create or replace function public.find_expense_category(p_company_id uuid, p_name text)
returns uuid
language sql
stable
set search_path = public
as $$
  select id
  from public.expense_categories
  where company_id = p_company_id
    and lower(translate(name, 'áéíóúÁÉÍÓÚ', 'aeiouAEIOU')) = lower(translate(p_name, 'áéíóúÁÉÍÓÚ', 'aeiouAEIOU'))
  order by created_at
  limit 1;
$$;

revoke execute on function public.find_expense_category(uuid, text) from public, anon;
grant execute on function public.find_expense_category(uuid, text) to authenticated;

-- 4) Categoría por defecto según el origen del movimiento. Devuelve null si
--    no aplica ninguna regla (el movimiento queda "Sin categoría").
create or replace function public.default_bank_transaction_category(
  p_company_id uuid,
  p_type text,
  p_bank_account_id uuid,
  p_customer_payment_id uuid,
  p_supplier_payment_id uuid,
  p_expense_id uuid,
  p_counterpart_account_id uuid
)
returns uuid
language plpgsql
stable
set search_path = public
as $$
declare
  v_expense_id uuid := p_expense_id;
  v_category uuid;
  v_is_card boolean;
begin
  -- Cobro de factura
  if p_customer_payment_id is not null then
    return public.find_expense_category(p_company_id, 'Cobro de factura');
  end if;

  -- Pago a proveedor / gasto: hereda la categoría del gasto
  if v_expense_id is null and p_supplier_payment_id is not null then
    select sp.expense_id into v_expense_id
    from public.supplier_payments sp
    where sp.id = p_supplier_payment_id;
  end if;
  if v_expense_id is not null then
    select e.category_id into v_category from public.expenses e where e.id = v_expense_id;
    if v_category is not null then
      return v_category;
    end if;
  end if;
  if p_supplier_payment_id is not null then
    return public.find_expense_category(p_company_id, 'Pago a suplidor');
  end if;
  if v_expense_id is not null then
    return public.find_expense_category(p_company_id, 'Otros gastos');
  end if;

  -- Transferencias
  if p_type = 'TRANSFER' then
    select bool_or(a.type = 'CREDIT_CARD') into v_is_card
    from public.bank_accounts a
    where a.id in (p_bank_account_id, p_counterpart_account_id);
    if coalesce(v_is_card, false) then
      return public.find_expense_category(p_company_id, 'Pago de tarjeta de crédito');
    end if;
    return public.find_expense_category(p_company_id, 'Transferencia entre cuentas');
  end if;

  return null;
end;
$$;

revoke execute on function public.default_bank_transaction_category(uuid, text, uuid, uuid, uuid, uuid, uuid)
  from public, anon;
grant execute on function public.default_bank_transaction_category(uuid, text, uuid, uuid, uuid, uuid, uuid)
  to authenticated;

-- 5) Relleno de los movimientos existentes sin categoría
update public.bank_transactions t
set category_id = public.default_bank_transaction_category(
  t.company_id, t.type, t.bank_account_id, t.customer_payment_id,
  t.supplier_payment_id, t.expense_id, t.counterpart_account_id
)
where t.category_id is null;

-- 6) Trigger: asigna la categoría a los movimientos nuevos que no traen una
create or replace function public.set_bank_transaction_default_category()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.category_id is null then
    new.category_id := public.default_bank_transaction_category(
      new.company_id, new.type, new.bank_account_id, new.customer_payment_id,
      new.supplier_payment_id, new.expense_id, new.counterpart_account_id
    );
  end if;
  return new;
end;
$$;

revoke execute on function public.set_bank_transaction_default_category() from public, anon, authenticated;

drop trigger if exists trg_bank_transaction_default_category on public.bank_transactions;
create trigger trg_bank_transaction_default_category
  before insert on public.bank_transactions
  for each row
  execute function public.set_bank_transaction_default_category();

-- 7) Transferencias: guardar el enlace entre las dos filas y la cuenta de
--    contraparte. Misma función que 055, solo agrega transfer_group_id y
--    counterpart_account_id a los dos inserts; los permisos se conservan
--    (create or replace no cambia los grants).
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
  v_group_id uuid := gen_random_uuid();
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
    transaction_date, description, transfer_group_id, counterpart_account_id
  ) values (
    p_company_id, p_from_account_id, 'TRANSFER', -p_amount, v_from.currency, 1,
    p_transaction_date, coalesce(p_description, 'Transferencia a ' || v_to.name),
    v_group_id, p_to_account_id
  );

  insert into public.bank_transactions (
    company_id, bank_account_id, type, amount, currency, exchange_rate,
    transaction_date, description, transfer_group_id, counterpart_account_id
  ) values (
    p_company_id, p_to_account_id, 'TRANSFER', p_amount, v_to.currency, 1,
    p_transaction_date, coalesce(p_description, 'Transferencia desde ' || v_from.name),
    v_group_id, p_from_account_id
  );

  insert into public.audit_logs (company_id, user_id, action, entity_type, entity_id, new_values)
  values (
    p_company_id, v_user_id, 'CREATE', 'bank_transfer', p_from_account_id,
    jsonb_build_object('to_account_id', p_to_account_id, 'amount', p_amount)
  );
end;
$function$;

