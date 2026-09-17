-- Comisión de la empresa: un % sobre el subtotal, visible para el
-- cliente, que se suma ANTES del descuento y ANTES del impuesto — es
-- decir, participa en la base sobre la que se calcula el ITBIS.
-- Orden final: Subtotal + Comisión − Descuento + ITBIS = Total.

alter table public.quotations
  add column if not exists commission_percent numeric(5, 2) not null default 0,
  add column if not exists commission_amount numeric(14, 2) not null default 0;

alter table public.invoices
  add column if not exists commission_percent numeric(5, 2) not null default 0,
  add column if not exists commission_amount numeric(14, 2) not null default 0;
