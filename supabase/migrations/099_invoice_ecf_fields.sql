-- 099 — 5b Factura lista para el Facturador Gratuito DGII.
--
-- Solo agrega datos (no cambia cálculos, totales, impuestos, retenciones ni reglas fiscales):
-- * Factura: tipo de ingreso (01 por defecto), comentarios, tipo de pago 3 «Gratuito».
-- * Cliente: ID extranjero, provincia y municipio (código e-CF de 6 dígitos).
-- * Línea: unidad de medida (código Tabla IV e-CF; 43 = Unidad) y bien o servicio.
-- * Catálogo: unidad de medida sugerida por producto/servicio.
-- * Factura emitida: el e-NCF, el código de seguridad, la fecha de firma y el «válido hasta» se pueden
--   ANOTAR UNA VEZ si estaban vacíos (vienen del Facturador después de emitir). Lo demás sigue bloqueado.
-- Idempotente.

alter table public.invoices
  add column if not exists income_type text not null default '01',
  add column if not exists ecf_comments text;
alter table public.invoices drop constraint if exists invoices_income_type_check;
alter table public.invoices add constraint invoices_income_type_check check (income_type in ('01', '02', '03', '04', '05', '06'));
alter table public.invoices drop constraint if exists invoices_payment_type_code_check;
alter table public.invoices add constraint invoices_payment_type_code_check check (payment_type_code is null or payment_type_code in ('1', '2', '3'));

alter table public.clients
  add column if not exists foreign_id text,
  add column if not exists province_code text,
  add column if not exists municipality_code text;
alter table public.clients drop constraint if exists clients_province_code_check;
alter table public.clients add constraint clients_province_code_check check (province_code is null or province_code ~ '^[0-9]{6}$');
alter table public.clients drop constraint if exists clients_municipality_code_check;
alter table public.clients add constraint clients_municipality_code_check
  check (municipality_code is null or (municipality_code ~ '^[0-9]{6}$' and (province_code is null or left(municipality_code, 2) = left(province_code, 2))));

alter table public.invoice_items
  add column if not exists unit_code text,
  add column if not exists item_kind text;
alter table public.invoice_items drop constraint if exists invoice_items_item_kind_check;
alter table public.invoice_items add constraint invoice_items_item_kind_check check (item_kind is null or item_kind in ('BIEN', 'SERVICIO'));
alter table public.invoice_items drop constraint if exists invoice_items_unit_code_check;
alter table public.invoice_items add constraint invoice_items_unit_code_check check (unit_code is null or unit_code ~ '^[0-9]{1,2}$');

alter table public.services add column if not exists unit_code text;
alter table public.services drop constraint if exists services_unit_code_check;
alter table public.services add constraint services_unit_code_check check (unit_code is null or unit_code ~ '^[0-9]{1,2}$');

-- Línea nueva: si no trae unidad o tipo, se toman del catálogo (o Unidad / Servicio).
create or replace function public.invoice_items_ecf_defaults()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_unit text;
  v_type text;
begin
  if new.service_id is not null and (new.unit_code is null or new.item_kind is null) then
    select unit_code, type into v_unit, v_type from public.services where id = new.service_id;
  end if;
  new.unit_code := coalesce(nullif(new.unit_code, ''), v_unit, '43');
  new.item_kind := coalesce(nullif(new.item_kind, ''), case when v_type = 'PRODUCTO' then 'BIEN' else 'SERVICIO' end);
  return new;
end;
$$;

drop trigger if exists trg_invoice_items_ecf_defaults on public.invoice_items;
create trigger trg_invoice_items_ecf_defaults
  before insert on public.invoice_items
  for each row execute function public.invoice_items_ecf_defaults();

-- Factura emitida: lo de siempre bloqueado; los datos que devuelve el Facturador se anotan una vez.
create or replace function public.guard_invoice_locked()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.mf_locked_docs_bypass() or old.status = 'DRAFT' then
    return new;
  end if;
  if (new.company_id, new.client_id, new.project_id, new.quotation_id, new.number, new.issue_date, new.due_date,
      new.subtotal, new.discount, new.tax, new.total, new.ncf, new.ncf_type, new.currency, new.exchange_rate,
      new.payment_terms_id, new.credit_days, new.commission_percent, new.commission_amount, new.billing_type,
      new.payment_type_code, new.income_type, new.ecf_comments,
      new.commission_tax_rate_id, new.commission_tax_treatment, new.commission_tax_rate_percent,
      new.created_by, new.created_at, new.duplicated_from_id)
     is distinct from
     (old.company_id, old.client_id, old.project_id, old.quotation_id, old.number, old.issue_date, old.due_date,
      old.subtotal, old.discount, old.tax, old.total, old.ncf, old.ncf_type, old.currency, old.exchange_rate,
      old.payment_terms_id, old.credit_days, old.commission_percent, old.commission_amount, old.billing_type,
      old.payment_type_code, old.income_type, old.ecf_comments,
      old.commission_tax_rate_id, old.commission_tax_treatment, old.commission_tax_rate_percent,
      old.created_by, old.created_at, old.duplicated_from_id)
  then
    raise exception 'issued_invoice_locked: la factura ya fue emitida; sus datos (cliente, NCF, fechas, montos, moneda) no se pueden cambiar. Para corregirla se anula o se hace una nota de crédito.'
      using errcode = 'P0001';
  end if;
  -- Datos del e-CF que devuelve el Facturador: se anotan una sola vez (si estaban vacíos).
  if (old.e_ncf is not null and new.e_ncf is distinct from old.e_ncf)
     or (old.security_code is not null and new.security_code is distinct from old.security_code)
     or (old.digital_signature_at is not null and new.digital_signature_at is distinct from old.digital_signature_at)
     or (old.e_ncf_valid_until is not null and new.e_ncf_valid_until is distinct from old.e_ncf_valid_until)
  then
    raise exception 'ecf_data_locked: el e-NCF y sus datos ya están anotados y no se pueden cambiar. Si hubo un error, se corrige con una nota de crédito.'
      using errcode = 'P0001';
  end if;
  if new.status = 'DRAFT' then
    raise exception 'issued_invoice_locked: una factura emitida no puede volver a Borrador.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;
