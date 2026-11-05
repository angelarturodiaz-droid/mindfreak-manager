-- 5b (ajuste 4-nov): adjuntar a la factura el e-CF que genera el Facturador Gratuito de la DGII (PDF y XML).
-- Los archivos van en `documents` con entity_type = 'invoice_ecf' (aparte del PDF interno de la factura, 'invoice').
-- Son la evidencia fiscal: no se pueden borrar (si se subió uno equivocado, se sube otro y vale el más reciente).

alter table public.documents drop constraint if exists documents_entity_type_check;
alter table public.documents add constraint documents_entity_type_check check (
  entity_type = any (array['quotation','invoice','expense','project','supplier','client','receipt','contract','other',
                           'delivery_receipt','asset','invoice_ecf']::text[])
);

drop policy if exists documents_delete on public.documents;
create policy documents_delete on public.documents
  for delete
  using (
    company_id in (select public.user_company_ids())
    and public.has_permission('documents.upload')
    and entity_type <> 'invoice_ecf'
  );

-- El archivo en Storage tampoco se borra ni se sobrescribe (carpeta <empresa>/invoice_ecf/...).
drop policy if exists documents_storage_delete on storage.objects;
create policy documents_storage_delete on storage.objects
  for delete
  using (
    bucket_id = 'documents'
    and ((storage.foldername(name))[1])::uuid in (select public.user_company_ids())
    and public.has_permission('documents.upload')
    and coalesce((storage.foldername(name))[2], '') <> 'invoice_ecf'
  );

drop policy if exists documents_storage_update on storage.objects;
create policy documents_storage_update on storage.objects
  for update
  using (
    bucket_id = 'documents'
    and ((storage.foldername(name))[1])::uuid in (select public.user_company_ids())
    and public.has_permission('documents.upload')
    and coalesce((storage.foldername(name))[2], '') <> 'invoice_ecf'
  );
