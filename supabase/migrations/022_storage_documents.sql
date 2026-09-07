-- F8: Bucket privado de Storage para documentos generados (PDFs de cotizaciones,
-- facturas, etc.) — se adelanta la infraestructura mínima de F17, ya que F0
-- fija "PDF + link de descarga" como requisito de V1 para cotizaciones.
-- Convención de ruta: {company_id}/{entity_type}/{entity_id}.pdf

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy documents_storage_select on storage.objects for select
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1]::uuid in (select public.user_company_ids())
    and public.has_permission('documents.view')
  );

create policy documents_storage_insert on storage.objects for insert
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1]::uuid in (select public.user_company_ids())
    and public.has_permission('documents.upload')
  );

create policy documents_storage_update on storage.objects for update
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1]::uuid in (select public.user_company_ids())
    and public.has_permission('documents.upload')
  );
