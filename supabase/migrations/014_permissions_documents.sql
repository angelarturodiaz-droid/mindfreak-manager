-- F4: Permisos faltantes para el módulo de Documentos (no estaba en la sección 9
-- del prompt maestro como módulo propio). Se asignan ampliamente a los 5 roles,
-- ya que documentos son transversales a casi todos los módulos.

insert into public.permissions (code, module, description) values
  ('documents.view', 'documents', 'Ver documentos adjuntos'),
  ('documents.upload', 'documents', 'Subir documentos adjuntos')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.company_id is null
  and r.name in ('ADMIN', 'MANAGER', 'SALES', 'FINANCE', 'OPERATIONS')
  and p.code in ('documents.view', 'documents.upload')
on conflict do nothing;
