-- F17: falta política de DELETE en documents (tabla) y en el bucket de
-- Storage — los documentos no están en la lista de "nunca borrar
-- físicamente" de F0-Arquitectura sección M (esa lista es
-- bank_transactions/customer_payments/supplier_payments/invoices/expenses),
-- así que si el usuario borra un documento (ej. subió el archivo
-- equivocado), debe borrarse de verdad. Reutiliza el permiso
-- 'documents.upload' (igual que insert), consistente con el patrón ya usado
-- en otras tablas para .update/.delete sin permiso dedicado.

create policy documents_delete on public.documents for delete
  using (
    company_id in (select public.user_company_ids())
    and public.has_permission('documents.upload')
  );

create policy documents_storage_delete on storage.objects for delete
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1]::uuid in (select public.user_company_ids())
    and public.has_permission('documents.upload')
  );
