-- Entregas y acuses de recibo (2026-09-30).
--
-- Registrar la entrega de documentos, equipos, materiales u otros artículos
-- a un cliente, imprimir el acuse (formato "Acuse de Entrega" de Mindfreak)
-- para firma manual y luego adjuntar el acuse firmado.
--
-- * delivery_receipts: encabezado del acuse (número ACU-0001, cliente,
--   proyecto opcional, tipo, fecha, destinatario, referencia, textos) y su
--   estado: DRAFT (borrador) → ISSUED (pendiente de firma) → SIGNED
--   (firmado); CANCELLED (anulado).
-- * delivery_receipt_items: las líneas (No., descripción, referencia,
--   cantidad).
-- * El acuse firmado se guarda en la tabla existente `documents`
--   (entity_type = 'delivery_receipt'), igual que los demás adjuntos.
-- * Permisos nuevos: deliveries.view / deliveries.create / deliveries.cancel.
--
-- Idempotente.

create table if not exists public.delivery_receipts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  number text not null,
  client_id uuid not null references public.clients (id) on delete restrict,
  project_id uuid references public.projects (id) on delete set null,
  delivery_type text not null default 'DOCUMENTS'
    check (delivery_type in ('DOCUMENTS', 'EQUIPMENT', 'MATERIALS', 'OTHER')),
  status text not null default 'DRAFT'
    check (status in ('DRAFT', 'ISSUED', 'SIGNED', 'CANCELLED')),
  subtitle text,
  delivery_date date not null default current_date,
  place text,
  recipient_name text not null,
  recipient_short_name text,
  recipient_department text,
  reference text,
  intro_text text,
  notes text,
  copies smallint not null default 2 check (copies between 1 and 5),
  delivered_by_name text,
  delivered_by_id_number text,
  received_by_name text,
  received_by_position text,
  received_at timestamptz,
  issued_at timestamptz,
  signed_at timestamptz,
  signed_by uuid references public.profiles (id) on delete set null,
  cancelled_at timestamptz,
  cancel_reason text,
  duplicated_from_id uuid references public.delivery_receipts (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_delivery_receipts_company_number
  on public.delivery_receipts (company_id, number);
create index if not exists idx_delivery_receipts_client on public.delivery_receipts (client_id);
create index if not exists idx_delivery_receipts_project on public.delivery_receipts (project_id);
create index if not exists idx_delivery_receipts_status on public.delivery_receipts (company_id, status);
create index if not exists idx_delivery_receipts_date on public.delivery_receipts (company_id, delivery_date desc);

create table if not exists public.delivery_receipt_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  receipt_id uuid not null references public.delivery_receipts (id) on delete cascade,
  position integer not null default 1,
  description text not null,
  reference text,
  quantity numeric(12, 2) not null default 1 check (quantity > 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_delivery_receipt_items_receipt
  on public.delivery_receipt_items (receipt_id, position);

drop trigger if exists set_updated_at on public.delivery_receipts;
create trigger set_updated_at
  before update on public.delivery_receipts
  for each row execute function public.set_updated_at();

-- RLS: mismo patrón que el resto (empresa del usuario + permiso)
alter table public.delivery_receipts enable row level security;
alter table public.delivery_receipt_items enable row level security;

drop policy if exists delivery_receipts_select on public.delivery_receipts;
create policy delivery_receipts_select on public.delivery_receipts
  for select using (company_id in (select public.user_company_ids()) and public.has_permission('deliveries.view'));

drop policy if exists delivery_receipts_insert on public.delivery_receipts;
create policy delivery_receipts_insert on public.delivery_receipts
  for insert with check (company_id in (select public.user_company_ids()) and public.has_permission('deliveries.create'));

drop policy if exists delivery_receipts_update on public.delivery_receipts;
create policy delivery_receipts_update on public.delivery_receipts
  for update using (
    company_id in (select public.user_company_ids())
    and (public.has_permission('deliveries.create') or public.has_permission('deliveries.cancel'))
  ) with check (
    company_id in (select public.user_company_ids())
    and (public.has_permission('deliveries.create') or public.has_permission('deliveries.cancel'))
  );

drop policy if exists delivery_receipts_delete on public.delivery_receipts;
create policy delivery_receipts_delete on public.delivery_receipts
  for delete using (company_id in (select public.user_company_ids()) and public.has_permission('deliveries.create'));

drop policy if exists delivery_receipt_items_select on public.delivery_receipt_items;
create policy delivery_receipt_items_select on public.delivery_receipt_items
  for select using (company_id in (select public.user_company_ids()) and public.has_permission('deliveries.view'));

drop policy if exists delivery_receipt_items_insert on public.delivery_receipt_items;
create policy delivery_receipt_items_insert on public.delivery_receipt_items
  for insert with check (company_id in (select public.user_company_ids()) and public.has_permission('deliveries.create'));

drop policy if exists delivery_receipt_items_update on public.delivery_receipt_items;
create policy delivery_receipt_items_update on public.delivery_receipt_items
  for update using (company_id in (select public.user_company_ids()) and public.has_permission('deliveries.create'))
  with check (company_id in (select public.user_company_ids()) and public.has_permission('deliveries.create'));

drop policy if exists delivery_receipt_items_delete on public.delivery_receipt_items;
create policy delivery_receipt_items_delete on public.delivery_receipt_items
  for delete using (company_id in (select public.user_company_ids()) and public.has_permission('deliveries.create'));

revoke all on public.delivery_receipts from anon;
revoke all on public.delivery_receipt_items from anon;
grant select, insert, update, delete on public.delivery_receipts to authenticated, service_role;
grant select, insert, update, delete on public.delivery_receipt_items to authenticated, service_role;

-- Permisos
insert into public.permissions (code, module, description) values
  ('deliveries.view', 'deliveries', 'Ver entregas y acuses de recibo'),
  ('deliveries.create', 'deliveries', 'Crear, editar, emitir y adjuntar acuses firmados'),
  ('deliveries.cancel', 'deliveries', 'Anular acuses de recibo')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on (
  (p.code = 'deliveries.view' and r.name in ('ADMIN', 'MANAGER', 'SALES', 'FINANCE', 'OPERATIONS'))
  or (p.code = 'deliveries.create' and r.name in ('ADMIN', 'MANAGER', 'SALES', 'OPERATIONS'))
  or (p.code = 'deliveries.cancel' and r.name in ('ADMIN', 'MANAGER'))
)
where r.company_id is null
on conflict do nothing;
