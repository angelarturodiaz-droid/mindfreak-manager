-- 079: Borrar una moneda del catálogo (Configuración → Monedas y tasas).
--
-- Solo se puede borrar una moneda que NUNCA se usó: no es la moneda
-- funcional y no tiene cuentas, cotizaciones, facturas, gastos, cobros,
-- pagos ni movimientos de banco (activos o no). Si se usó, se desactiva
-- (no se borra: el historial la necesita). Las tasas de referencia de esa
-- moneda se borran junto con ella (son solo referencia; cada operación
-- guarda su propia tasa).
--
-- Atómica, con permiso settings.manage y auditoría. Idempotente.
-- Aplicada en producción el 6-oct-2026.

create or replace function public.delete_currency(p_currency_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cur record;
  v_functional text;
  v_used text[] := '{}';
  v_n bigint;
  v_rates bigint;
begin
  if not public.has_permission('settings.manage') then
    raise exception 'insufficient_privilege: falta el permiso settings.manage';
  end if;

  select * into v_cur from public.currencies where id = p_currency_id for update;
  if not found or v_cur.company_id not in (select * from public.user_company_ids()) then
    raise exception 'currency_not_found: la moneda no existe';
  end if;

  select base_currency into v_functional from public.companies where id = v_cur.company_id;
  if v_cur.code = v_functional then
    raise exception 'currency_in_use: % es la moneda funcional de la empresa', v_cur.code;
  end if;

  select count(*) into v_n from public.bank_accounts where company_id = v_cur.company_id and currency = v_cur.code;
  if v_n > 0 then v_used := v_used || format('%s cuenta(s)', v_n); end if;
  select count(*) into v_n from public.quotations where company_id = v_cur.company_id and currency = v_cur.code;
  if v_n > 0 then v_used := v_used || format('%s cotización(es)', v_n); end if;
  select count(*) into v_n from public.invoices where company_id = v_cur.company_id and currency = v_cur.code;
  if v_n > 0 then v_used := v_used || format('%s factura(s)', v_n); end if;
  select count(*) into v_n from public.expenses where company_id = v_cur.company_id and currency = v_cur.code;
  if v_n > 0 then v_used := v_used || format('%s gasto(s)', v_n); end if;
  select count(*) into v_n from public.customer_payments
    where company_id = v_cur.company_id and (currency = v_cur.code or account_currency = v_cur.code);
  if v_n > 0 then v_used := v_used || format('%s cobro(s)', v_n); end if;
  select count(*) into v_n from public.supplier_payments
    where company_id = v_cur.company_id and (currency = v_cur.code or account_currency = v_cur.code);
  if v_n > 0 then v_used := v_used || format('%s pago(s)', v_n); end if;
  select count(*) into v_n from public.bank_transactions where company_id = v_cur.company_id and currency = v_cur.code;
  if v_n > 0 then v_used := v_used || format('%s movimiento(s) de banco', v_n); end if;

  if array_length(v_used, 1) > 0 then
    raise exception 'currency_in_use: % ya se usó en %', v_cur.code, array_to_string(v_used, ', ');
  end if;

  delete from public.exchange_rates where company_id = v_cur.company_id and currency_code = v_cur.code;
  get diagnostics v_rates = row_count;
  delete from public.currencies where id = p_currency_id;

  insert into public.audit_logs (company_id, user_id, action, entity_type, entity_id, old_values)
  values (
    v_cur.company_id, auth.uid(), 'DELETE', 'currency', p_currency_id,
    jsonb_build_object('code', v_cur.code, 'name', v_cur.name, 'is_active', v_cur.is_active, 'exchange_rates_deleted', v_rates)
  );
end;
$$;

revoke all on function public.delete_currency(uuid) from public, anon;
grant execute on function public.delete_currency(uuid) to authenticated, service_role;
