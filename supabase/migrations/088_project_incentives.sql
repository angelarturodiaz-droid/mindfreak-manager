-- 088: V1-2 Incentivos por proyecto (decidido con el contador, 22-oct-2026).
--
-- Un incentivo es un GASTO del proyecto (misma tabla expenses) con:
--   * categoría «Incentivo por proyecto» (una sola para empleados y terceros);
--   * SIN proveedor, SIN ITBIS y SIN retenciones (se paga el monto completo);
--   * quién lo recibe, si es empleado o tercero, el motivo y cómo se calculó
--     (monto fijo o % de la «ganancia antes de incentivos», con la base usada).
-- En la rentabilidad del proyecto se resta DESPUÉS de los gastos, en su propio
-- renglón. Para la empresa (Dashboard, Comparaciones) sigue siendo un gasto.
--
-- Solo AGREGA: columnas nuevas (nulas), una categoría y un permiso. No toca el
-- motor fiscal, retenciones, net_payable ni fiscal_snapshot. Idempotente.

-- 1. Columnas del incentivo en el gasto --------------------------------------

alter table public.expenses
  add column if not exists incentive_recipient text,
  add column if not exists incentive_recipient_type text,
  add column if not exists incentive_reason text,
  add column if not exists incentive_mode text,
  add column if not exists incentive_percent numeric(7, 4),
  add column if not exists incentive_base numeric(14, 2),
  add column if not exists incentive_base_at timestamptz;

do $do$
begin
  if not exists (select 1 from pg_constraint where conname = 'expenses_incentive_recipient_type_check') then
    alter table public.expenses add constraint expenses_incentive_recipient_type_check
      check (incentive_recipient_type is null or incentive_recipient_type in ('EMPLOYEE', 'THIRD_PARTY'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'expenses_incentive_mode_check') then
    alter table public.expenses add constraint expenses_incentive_mode_check
      check (incentive_mode is null or incentive_mode in ('FIXED', 'PERCENT'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'expenses_incentive_percent_check') then
    alter table public.expenses add constraint expenses_incentive_percent_check
      check (incentive_percent is null or (incentive_percent > 0 and incentive_percent <= 100));
  end if;
  -- Un incentivo no lleva proveedor ni ITBIS, siempre tiene a quién y a un proyecto,
  -- y si es por % guarda el % y la base usada.
  if not exists (select 1 from pg_constraint where conname = 'expenses_incentive_shape_check') then
    alter table public.expenses add constraint expenses_incentive_shape_check
      check (
        incentive_mode is null
        or (
          supplier_id is null
          and tax = 0
          and project_id is not null
          and coalesce(btrim(incentive_recipient), '') <> ''
          and incentive_recipient_type is not null
          and (incentive_mode = 'FIXED' or (incentive_percent is not null and incentive_base is not null))
        )
      );
  end if;
end
$do$;

create index if not exists expenses_project_incentive_idx
  on public.expenses (company_id, project_id)
  where incentive_mode is not null;

comment on column public.expenses.incentive_mode is
  'V1-2: FIXED (monto fijo) o PERCENT (% de la ganancia antes de incentivos). Nulo = gasto normal.';
comment on column public.expenses.incentive_base is
  'V1-2: ganancia antes de incentivos (ventas sin ITBIS − gastos sin ITBIS, sin incentivos) usada para el %, en moneda base.';

-- 2. Categoría «Incentivo por proyecto» (catálogo; la limpieza no la borra) ---

insert into public.expense_categories (company_id, name, description)
select c.id,
       'Incentivo por proyecto',
       'Pago a un empleado o tercero por un proyecto (sin proveedor, sin ITBIS y sin retenciones). Se resta después de los gastos en la rentabilidad del proyecto. A un empleado se le paga aparte de la nómina.'
from public.companies c
where not exists (
  select 1 from public.expense_categories ec
  where ec.company_id = c.id and public.catalog_key(ec.name) = public.catalog_key('Incentivo por proyecto')
);

-- 3. Permiso: solo Administrador y Finanzas crean incentivos -----------------

insert into public.permissions (code, module, description) values
  ('expenses.incentives', 'expenses', 'Crear y recalcular incentivos por proyecto (pagos a empleados o terceros)')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code = 'expenses.incentives'
where r.company_id is null and r.name in ('ADMIN', 'FINANCE')
on conflict do nothing;
