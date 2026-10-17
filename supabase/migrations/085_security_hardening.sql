-- 085 — Refuerzo de seguridad (prueba BD), aprobado por el usuario el 16-oct-2026.
-- Propuesta: claude/propuesta-refuerzo-seguridad-bd.md
--
-- 1. Usuario desactivado = sin acceso real: has_permission() y
--    user_company_ids() no devuelven nada si profiles.is_active = false, así
--    RLS lo bloquea al instante aunque tenga una sesión abierta o un equipo
--    "recordado". (La app además bloquea la cuenta en Auth y cierra la sesión.)
-- 2. Administradores con verificación en dos pasos obligatoria: los permisos
--    de administrador (users.manage y settings.manage) solo valen si el
--    usuario tiene un factor 2FA verificado. "Recordar este equipo" se
--    mantiene (se exige tenerla ACTIVADA, no el código en cada sesión).
-- 3. Documentos emitidos fijos en la base: líneas y datos de una factura que
--    ya no está en Borrador, y líneas de una cotización fuera de Borrador o
--    Negociación, no se pueden cambiar. Excepción explícita para tareas de
--    mantenimiento (limpieza Go-Live): set_config('mf.allow_locked_docs','on', true).
--
-- No toca evaluateFiscal, retenciones, net_payable ni fiscal_snapshot.

-- ---------------------------------------------------------------- 1 y 2

create or replace function public.has_permission(permission_code text)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.permissions p on p.id = rp.permission_id
    join public.profiles pr on pr.id = ur.user_id and pr.is_active
    where ur.user_id = auth.uid()
      and p.code = permission_code
  )
  -- Permisos de administrador: además, 2FA activada.
  and (
    permission_code not in ('users.manage', 'settings.manage')
    or exists (
      select 1 from auth.mfa_factors f
      where f.user_id = auth.uid() and f.status = 'verified'
    )
  );
$function$;

create or replace function public.user_company_ids()
returns setof uuid
language sql
stable security definer
set search_path to 'public'
as $function$
  select ur.company_id
  from public.user_roles ur
  join public.profiles pr on pr.id = ur.user_id and pr.is_active
  where ur.user_id = auth.uid();
$function$;

-- Estado de la sesión para la app (en cada navegación): ¿cuenta activa? ¿es
-- administrador sin 2FA (debe activarla antes de seguir)?
create or replace function public.session_status()
returns jsonb
language sql
stable security definer
set search_path to 'public'
as $function$
  select jsonb_build_object(
    'active', coalesce((select pr.is_active from public.profiles pr where pr.id = auth.uid()), false),
    'needs_mfa',
      exists (
        select 1
        from public.user_roles ur
        join public.role_permissions rp on rp.role_id = ur.role_id
        join public.permissions p on p.id = rp.permission_id
        where ur.user_id = auth.uid() and p.code in ('users.manage', 'settings.manage')
      )
      and not exists (
        select 1 from auth.mfa_factors f
        where f.user_id = auth.uid() and f.status = 'verified'
      )
  );
$function$;

revoke all on function public.session_status() from public, anon;
grant execute on function public.session_status() to authenticated;

-- ---------------------------------------------------------------- 3

create or replace function public.mf_locked_docs_bypass()
returns boolean
language sql
stable
as $function$
  select coalesce(current_setting('mf.allow_locked_docs', true), '') = 'on';
$function$;

-- Líneas de factura: solo en Borrador.
create or replace function public.guard_invoice_items_locked()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_status text;
begin
  if public.mf_locked_docs_bypass() then
    return coalesce(new, old);
  end if;
  select status into v_status
    from public.invoices
   where id = coalesce(new.invoice_id, old.invoice_id);
  -- Si la factura ya no existe (borrado en cascada de un borrador) se permite.
  if v_status is not null and v_status <> 'DRAFT' then
    raise exception 'issued_invoice_locked: la factura ya fue emitida; sus líneas no se pueden cambiar. Para corregirla se anula o se hace una nota de crédito.'
      using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' and new.invoice_id <> old.invoice_id then
    select status into v_status from public.invoices where id = old.invoice_id;
    if v_status is not null and v_status <> 'DRAFT' then
      raise exception 'issued_invoice_locked: la factura ya fue emitida; sus líneas no se pueden cambiar.'
        using errcode = 'P0001';
    end if;
  end if;
  return coalesce(new, old);
end;
$function$;

drop trigger if exists trg_invoice_items_locked on public.invoice_items;
create trigger trg_invoice_items_locked
  before insert or update or delete on public.invoice_items
  for each row execute function public.guard_invoice_items_locked();

-- Factura emitida: los datos del documento quedan fijos. Se permite lo que
-- el sistema hace legítimamente después de emitir: estado, pagado, balance,
-- retenciones (cobros), datos bancarios del pie, enviada al cliente,
-- responsable de cobro y updated_at.
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
      new.e_ncf, new.e_ncf_valid_until, new.payment_type_code, new.security_code, new.digital_signature_at,
      new.commission_tax_rate_id, new.commission_tax_treatment, new.commission_tax_rate_percent,
      new.created_by, new.created_at, new.duplicated_from_id)
     is distinct from
     (old.company_id, old.client_id, old.project_id, old.quotation_id, old.number, old.issue_date, old.due_date,
      old.subtotal, old.discount, old.tax, old.total, old.ncf, old.ncf_type, old.currency, old.exchange_rate,
      old.payment_terms_id, old.credit_days, old.commission_percent, old.commission_amount, old.billing_type,
      old.e_ncf, old.e_ncf_valid_until, old.payment_type_code, old.security_code, old.digital_signature_at,
      old.commission_tax_rate_id, old.commission_tax_treatment, old.commission_tax_rate_percent,
      old.created_by, old.created_at, old.duplicated_from_id)
  then
    raise exception 'issued_invoice_locked: la factura ya fue emitida; sus datos (cliente, NCF, fechas, montos, moneda) no se pueden cambiar. Para corregirla se anula o se hace una nota de crédito.'
      using errcode = 'P0001';
  end if;
  -- Una factura no vuelve a Borrador.
  if new.status = 'DRAFT' then
    raise exception 'issued_invoice_locked: una factura emitida no puede volver a Borrador.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_invoice_locked on public.invoices;
create trigger trg_invoice_locked
  before update on public.invoices
  for each row execute function public.guard_invoice_locked();

-- Líneas de cotización: solo en Borrador o Negociación (como en pantalla).
create or replace function public.guard_quotation_items_locked()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_status text;
begin
  if public.mf_locked_docs_bypass() then
    return coalesce(new, old);
  end if;
  select status into v_status
    from public.quotations
   where id = coalesce(new.quotation_id, old.quotation_id);
  if v_status is not null and v_status not in ('DRAFT', 'NEGOTIATING') then
    raise exception 'locked_quotation: la cotización ya no está en Borrador ni en Negociación; sus líneas no se pueden cambiar.'
      using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end;
$function$;

drop trigger if exists trg_quotation_items_locked on public.quotation_items;
create trigger trg_quotation_items_locked
  before insert or update or delete on public.quotation_items
  for each row execute function public.guard_quotation_items_locked();
