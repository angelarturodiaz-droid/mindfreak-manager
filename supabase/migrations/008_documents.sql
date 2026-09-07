-- F3: Documentos (Supabase Storage metadata) + FKs pendientes de la migración 007
-- Ver F0-Arquitectura, sección G "Documentos"

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  entity_type text not null check (
    entity_type in ('quotation', 'invoice', 'expense', 'project', 'supplier', 'client', 'receipt', 'contract', 'other')
  ),
  entity_id uuid not null,
  file_name text not null,
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_documents_entity on public.documents (entity_type, entity_id);

-- FKs diferidas desde 007 (ahora que documents ya existe)
alter table public.customer_payments
  add constraint fk_cp_document foreign key (document_id) references public.documents (id) on delete set null;
alter table public.expenses
  add constraint fk_expenses_document foreign key (document_id) references public.documents (id) on delete set null;
alter table public.supplier_payments
  add constraint fk_sp_document foreign key (document_id) references public.documents (id) on delete set null;
