-- Proveedores: agregar Cuenta Banco (a qué banco/cuenta se le paga) y Tipo
-- de servicio (distinto de "category", que ya se usa como etiqueta libre
-- de rubro). Mismo patrón que payee_bank_name (038) para el nombre del
-- banco: texto libre, con el catálogo bank_catalog (040) como sugerencia
-- en el formulario, no como llave foránea — así no se rompe si el
-- proveedor usa un banco fuera del catálogo.

alter table public.suppliers
  add column if not exists bank_name text,
  add column if not exists bank_account_number text,
  add column if not exists service_type text;

comment on column public.suppliers.bank_name is 'Banco de la cuenta donde se le paga al proveedor (texto libre, catálogo bank_catalog como sugerencia).';
comment on column public.suppliers.bank_account_number is 'Número de cuenta bancaria del proveedor para transferencias/pagos.';
comment on column public.suppliers.service_type is 'Tipo de servicio que ofrece el proveedor (texto libre, distinto de category).';
