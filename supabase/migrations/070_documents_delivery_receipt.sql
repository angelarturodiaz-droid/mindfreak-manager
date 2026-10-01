-- 070: el acuse firmado de Entregas (067) se guarda en `documents` con
-- entity_type 'delivery_receipt', pero la restricción de la tabla no lo
-- incluía y la subida fallaba con "violates check constraint
-- documents_entity_type_check". Se agrega a la lista permitida.
-- Idempotente.

alter table public.documents drop constraint if exists documents_entity_type_check;
alter table public.documents add constraint documents_entity_type_check
  check (entity_type in ('quotation', 'invoice', 'expense', 'project', 'supplier', 'client', 'receipt', 'contract', 'other', 'delivery_receipt'));
