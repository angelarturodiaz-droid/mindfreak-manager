-- 089: pagar después un incentivo por proyecto (V1-2), que no tiene proveedor.
--
-- Hasta ahora todo pago (supplier_payments) exigía proveedor, así que un
-- incentivo que quedaba pendiente no se podía pagar. Ahora:
--   * supplier_payments.supplier_id acepta NULL;
--   * un trigger solo lo permite si el gasto es un INCENTIVO sin proveedor.
--     Un gasto normal sigue necesitando proveedor para pagarse (retenciones).
-- No cambia register_supplier_payment ni nada fiscal. Solo agrega. Idempotente.

alter table public.supplier_payments alter column supplier_id drop not null;

create or replace function public.guard_supplier_payment_supplier()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.supplier_id is null then
    if not exists (
      select 1 from public.expenses e
      where e.id = new.expense_id
        and e.supplier_id is null
        and e.incentive_mode is not null
    ) then
      raise exception 'supplier_required: para pagar este gasto primero asígnale un proveedor (edita el gasto). Solo los incentivos por proyecto se pagan sin proveedor.';
    end if;
  end if;
  return new;
end;
$$;

do $do$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'guard_supplier_payment_supplier_trigger' and tgrelid = 'public.supplier_payments'::regclass
  ) then
    create trigger guard_supplier_payment_supplier_trigger
      before insert or update of supplier_id on public.supplier_payments
      for each row execute function public.guard_supplier_payment_supplier();
  end if;
end
$do$;

comment on function public.guard_supplier_payment_supplier() is
  '089: un pago sin proveedor solo se permite para incentivos por proyecto (gasto sin proveedor con incentive_mode).';
