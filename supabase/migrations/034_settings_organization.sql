-- Módulo de Configuración — sección Organización. Campos aditivos, no
-- rompen nada existente (logo_url, platform_name, brand_primary,
-- brand_accent, base_currency ya existían desde F1/F3 sin pantalla propia).

alter table public.companies
  add column if not exists address text,
  add column if not exists phone text,
  add column if not exists email text;

-- Bucket PÚBLICO para el logo (distinto al bucket privado 'documents' de F8):
-- el logo se usa en un <img> directo en toda la UI, no debe depender de un
-- link firmado que expira. No es información sensible, público es correcto.
insert into storage.buckets (id, name, public)
values ('branding', 'branding', true)
on conflict (id) do nothing;

create policy branding_storage_insert on storage.objects for insert
  with check (
    bucket_id = 'branding'
    and (storage.foldername(name))[1]::uuid in (select public.user_company_ids())
    and public.has_permission('settings.manage')
  );

create policy branding_storage_update on storage.objects for update
  using (
    bucket_id = 'branding'
    and (storage.foldername(name))[1]::uuid in (select public.user_company_ids())
    and public.has_permission('settings.manage')
  );

create policy branding_storage_delete on storage.objects for delete
  using (
    bucket_id = 'branding'
    and (storage.foldername(name))[1]::uuid in (select public.user_company_ids())
    and public.has_permission('settings.manage')
  );
