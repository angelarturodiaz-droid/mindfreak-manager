-- 084 — Identidad visual de cada banco del catálogo (color y logo).
-- Se guarda una vez por banco en bank_catalog y la usan todas las cuentas
-- y tarjetas de ese banco (se enlazan por bank_accounts.bank_name = nombre).
-- El logo se guarda como imagen pequeña (128 px, data URL) en la misma fila:
-- no hace falta un bucket público ni URLs firmadas. Solo informativo/visual:
-- no toca saldos, movimientos ni ninguna lógica de dinero.

alter table public.bank_catalog
  add column if not exists brand_color text,
  add column if not exists logo_data text;

alter table public.bank_catalog
  drop constraint if exists bank_catalog_brand_color_hex,
  add constraint bank_catalog_brand_color_hex
    check (brand_color is null or brand_color ~ '^#[0-9a-fA-F]{6}$');

alter table public.bank_catalog
  drop constraint if exists bank_catalog_logo_data_image,
  add constraint bank_catalog_logo_data_image
    check (
      logo_data is null
      or (logo_data ~ '^data:image/(png|webp|jpeg);base64,' and length(logo_data) <= 200000)
    );

comment on column public.bank_catalog.brand_color is 'Color del banco (#rrggbb) para las tarjetas de sus cuentas.';
comment on column public.bank_catalog.logo_data is 'Logo del banco (data URL png/webp/jpeg, máx. ~150 KB). Lo sube el usuario.';

-- Colores sugeridos para los bancos conocidos (editables en Configuración → Catálogo de bancos).
update public.bank_catalog set brand_color = '#00558c' where name = 'Banreservas' and brand_color is null;
update public.bank_catalog set brand_color = '#12336f' where name = 'Banco Popular Dominicano' and brand_color is null;
update public.bank_catalog set brand_color = '#1f8a3a' where name = 'Banco BHD' and brand_color is null;
update public.bank_catalog set brand_color = '#0f6a37' where name = 'Banco Promerica' and brand_color is null;
