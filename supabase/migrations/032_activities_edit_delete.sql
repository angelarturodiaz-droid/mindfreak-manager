-- Ajuste post-F18: el usuario pidió poder editar/borrar una actividad
-- (corregir una nota, quitar una entrada duplicada). Se revierte la
-- decisión original de dejarla inmutable como audit_logs — una actividad
-- no es un registro financiero ni de auditoría del sistema, así que permitir
-- editar/borrar es razonable y no compromete la integridad financiera
-- (F0-Arquitectura, sección M solo restringe borrado físico de
-- bank_transactions/customer_payments/supplier_payments/invoices/expenses).

create policy activities_update on public.activities for update
  using (company_id in (select public.user_company_ids()) and public.has_permission('projects.update'))
  with check (company_id in (select public.user_company_ids()) and public.has_permission('projects.update'));

create policy activities_delete on public.activities for delete
  using (company_id in (select public.user_company_ids()) and public.has_permission('projects.update'));
