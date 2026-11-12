-- Rol «Contador» (11-nov-2026; nombre y descripción generales el mismo día: es el rol del contador, no solo para revisar).
-- El contador externo entra con su propio usuario, consulta gastos, pagos, proveedores y reportes (solo lectura) y
-- marca cada regla fiscal como revisada. No puede crear, editar, activar, desactivar ni borrar reglas, ni registrar
-- nada. Queda guardado quién revisó cada regla y cuándo (también en la Auditoría).
-- No cambia evaluateFiscal, las reglas, net_payable ni fiscal_snapshot: solo agrega un permiso, un rol y una función
-- que pone needs_review = false.

insert into public.permissions (code, module, description) values
  ('fiscal_rules.review', 'settings', 'Revisar y confirmar las reglas fiscales (contador): ver y marcar como revisadas, sin editarlas')
on conflict (code) do nothing;

insert into public.roles (company_id, name, description, is_system)
select null, 'CONTADOR', 'Contador de la empresa: consulta gastos, pagos, proveedores y reportes (solo lectura) y confirma las reglas fiscales', true
where not exists (select 1 from public.roles where company_id is null and name = 'CONTADOR');

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
  from public.roles r
  join public.permissions p
    on (r.name = 'CONTADOR' and p.code in ('fiscal_rules.review', 'expenses.view', 'payments.view', 'suppliers.view',
                                           'reports.view', 'documents.view'))
    or (r.name = 'ADMIN' and p.code = 'fiscal_rules.review')
 where r.company_id is null
on conflict do nothing;

-- Marcar como revisada: Administración (settings.manage) o el contador (fiscal_rules.review).
create or replace function public.mark_fiscal_rule_reviewed(p_rule_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rule public.fiscal_rules;
  v_at timestamptz := now();
begin
  if not (public.has_permission('fiscal_rules.review') or public.has_permission('settings.manage')) then
    raise exception 'fiscal_review_forbidden: no tienes permiso para revisar reglas fiscales.' using errcode = 'P0001';
  end if;
  select * into v_rule from public.fiscal_rules
   where id = p_rule_id and company_id in (select public.user_company_ids());
  if v_rule.id is null then
    raise exception 'fiscal_rule_not_found: no se encontró la regla.' using errcode = 'P0001';
  end if;
  update public.fiscal_rules
     set needs_review = false, last_reviewed_at = v_at, reviewed_by = auth.uid()
   where id = p_rule_id;
  insert into public.audit_logs (company_id, user_id, action, entity_type, entity_id, new_values)
  values (v_rule.company_id, auth.uid(), 'REVIEWED', 'fiscal_rule', p_rule_id,
          jsonb_build_object('regla', v_rule.name, 'version', v_rule.version));
  return v_at;
end;
$$;

revoke execute on function public.mark_fiscal_rule_reviewed(uuid) from public, anon;
grant execute on function public.mark_fiscal_rule_reviewed(uuid) to authenticated;

-- Ajuste del mismo día: descripción general del rol (ya existía con la anterior).
update public.roles
   set description = 'Contador de la empresa: consulta gastos, pagos, proveedores y reportes (solo lectura) y confirma las reglas fiscales'
 where company_id is null and name = 'CONTADOR';
