-- El bucket 'branding' (creado en 034_settings_organization.sql) tiene un
-- problema real de RLS que INSERT en storage.objects rechaza incluso con
-- una política trivial `with check (true)` — se investigó a fondo
-- (triggers, grants, public/private, bucket completamente nuevo con
-- política propia) sin encontrar la causa raíz. El logo de la empresa
-- ahora se guarda en el bucket 'documents' (probado y estable desde F8,
-- dentro de una subcarpeta "branding/"), con un link firmado de larga
-- duración (~10 años) en vez de una URL pública directa, ya que
-- 'documents' es privado.
--
-- Se dejan las políticas del bucket 'branding' eliminadas para no dejar
-- infraestructura muerta/confusa; el bucket en sí no se puede borrar por
-- SQL directo (protegido por trigger de Supabase Storage), queda inerte
-- y sin usar — inofensivo.

drop policy if exists branding_storage_insert on storage.objects;
drop policy if exists branding_storage_update on storage.objects;
drop policy if exists branding_storage_delete on storage.objects;
