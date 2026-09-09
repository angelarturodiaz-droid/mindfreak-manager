-- Ampliar el catálogo de servicios para reflejar que Mindfreak Events también
-- vende bienes físicos (extintores, libretas, etc.), no solo servicios.
-- No se renombra la tabla `services` ni la columna `service_id` que ya usan
-- quotation_items/project_items/invoice_items — son aditivas, sin romper
-- nada existente. Solo cambia la etiqueta visible en la UI a
-- "Productos y Servicios". Ver conversación con el usuario.

alter table public.services
  add column if not exists type text not null default 'SERVICIO' check (type in ('PRODUCTO', 'SERVICIO')),
  add column if not exists description text,
  add column if not exists default_tax_percent numeric(6, 3) not null default 0;
