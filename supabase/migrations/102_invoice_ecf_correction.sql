-- 6-nov: corregir los datos del e-CF anotados por error de tipeo (el e-CF de la DGII está bien, se escribió mal en el ERP).
-- Solo con el permiso invoices.ecf_correct (Administrador), con motivo, por la función correct_invoice_ecf.
-- El resto de la factura emitida sigue bloqueado igual que antes.

insert into public.permissions (code, module, description) values
  ('invoices.ecf_correct', 'invoices', 'Corregir los datos del e-CF anotados (e-NCF, código, fecha de firma) por un error de tipeo, con motivo')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code = 'invoices.ecf_correct'
where r.company_id is null and r.name = 'ADMIN'
on conflict do nothing;

create or replace function public.guard_invoice_locked()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
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
  -- Corrección autorizada (correct_invoice_ecf): deja cambiar solo los datos del e-CF.
  if coalesce(current_setting('mf.ecf_correction', true), '') <> 'on' and (
     (old.e_ncf is not null and new.e_ncf is distinct from old.e_ncf)
     or (old.security_code is not null and new.security_code is distinct from old.security_code)
     or (old.digital_signature_at is not null and new.digital_signature_at is distinct from old.digital_signature_at)
     or (old.e_ncf_valid_until is not null and new.e_ncf_valid_until is distinct from old.e_ncf_valid_until))
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
$function$;

create or replace function public.correct_invoice_ecf(
  p_invoice_id uuid,
  p_e_ncf text,
  p_security_code text,
  p_signature_at timestamptz,
  p_valid_until date,
  p_reason text
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_inv record;
begin
  if not public.has_permission('invoices.ecf_correct') then
    raise exception 'ecf_correct_forbidden: solo Administración puede corregir los datos del e-CF.' using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 10 then
    raise exception 'ecf_correct_reason: escribe el motivo (mínimo 10 letras).' using errcode = 'P0001';
  end if;
  select id, billing_type, status, ncf_type, e_ncf into v_inv from public.invoices where id = p_invoice_id;
  if v_inv.id is null then
    raise exception 'ecf_correct_not_found: no se encontró la factura.' using errcode = 'P0001';
  end if;
  if v_inv.billing_type <> 'ELECTRONIC' or v_inv.e_ncf is null then
    raise exception 'ecf_correct_not_applicable: la factura no es electrónica o todavía no tiene e-NCF anotado.' using errcode = 'P0001';
  end if;
  if p_e_ncf is null or p_e_ncf !~ '^E[0-9]{12}$' then
    raise exception 'ecf_correct_format: el e-NCF debe ser una E seguida de 12 números.' using errcode = 'P0001';
  end if;
  if v_inv.ncf_type ~ '^[0-9]{2}$' and substr(p_e_ncf, 2, 2) <> v_inv.ncf_type then
    raise exception 'ecf_correct_type: el e-NCF empieza con E%, pero la factura es tipo %.', substr(p_e_ncf, 2, 2), v_inv.ncf_type using errcode = 'P0001';
  end if;

  perform set_config('mf.ecf_correction', 'on', true);
  update public.invoices
     set e_ncf = p_e_ncf,
         security_code = nullif(trim(coalesce(p_security_code, '')), ''),
         digital_signature_at = p_signature_at,
         e_ncf_valid_until = p_valid_until
   where id = p_invoice_id;
  perform set_config('mf.ecf_correction', '', true);
end;
$$;

revoke all on function public.correct_invoice_ecf(uuid, text, text, timestamptz, date, text) from public, anon;
grant execute on function public.correct_invoice_ecf(uuid, text, text, timestamptz, date, text) to authenticated;
