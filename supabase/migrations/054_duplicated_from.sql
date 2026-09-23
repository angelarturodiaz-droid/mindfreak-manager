-- Marca visual de "Duplicada de ..." en cotizaciones y facturas: guarda una
-- referencia al documento original del que salió la copia (nula si el
-- documento no es una duplicación de otro). Se usa solo para mostrar un
-- badge/enlace en la lista y el detalle — no participa en ningún cálculo.
-- on delete set null: si se borra el original, la copia no se rompe, solo
-- deja de mostrar la marca.

alter table public.quotations
  add column if not exists duplicated_from_id uuid references public.quotations (id) on delete set null;

alter table public.invoices
  add column if not exists duplicated_from_id uuid references public.invoices (id) on delete set null;

create index if not exists idx_quotations_duplicated_from on public.quotations (duplicated_from_id);
create index if not exists idx_invoices_duplicated_from on public.invoices (duplicated_from_id);
