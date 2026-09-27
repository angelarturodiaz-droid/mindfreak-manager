-- Catálogo inicial para un negocio de eventos (2026-09-27): categorías de
-- proveedores y sus tipos de servicio, para salir a producción con la
-- lista ya lista. Se agregan a Configuración > Categorías (misma lista de
-- gastos y movimientos de banco) y a Configuración > Tipos de servicio.
--
-- * No duplica: compara nombres sin mayúsculas ni acentos. Lo que ya
--   existe se reutiliza (ej. "Catering y alimentos", "Transporte y
--   combustible", "Decoracion").
-- * "Audio visuales" (creada desde un proveedor en 064) pasa a llamarse
--   "Audiovisuales" para no tener dos categorías iguales.
-- * Todo se puede editar o borrar después desde Configuración.
--
-- Idempotente. Probada dos veces en base local.

-- 1) Unificar "Audio visuales" → "Audiovisuales"
update public.expense_categories ec
set name = 'Audiovisuales'
where ec.id in (
    select distinct on (company_id) id
    from public.expense_categories
    where lower(translate(replace(name, ' ', ''), 'áéíóúÁÉÍÓÚ', 'aeiouAEIOU')) = 'audiovisuales'
    order by company_id, created_at
  )
  and ec.name <> 'Audiovisuales'
  and not exists (
    select 1 from public.expense_categories x
    where x.company_id = ec.company_id and x.name = 'Audiovisuales'
  );

update public.suppliers s
set category = c.name
from public.expense_categories c
where s.category_id = c.id and s.category is distinct from c.name;

-- 2) Catálogo
drop table if exists tmp_event_catalog;
create temporary table tmp_event_catalog (category text, description text, service_type text);

insert into tmp_event_catalog (category, description, service_type) values
  ('Audiovisuales', 'Sonido, pantallas, video y equipos técnicos', 'Alquiler de sonido'),
  ('Audiovisuales', 'Sonido, pantallas, video y equipos técnicos', 'Pantallas LED'),
  ('Audiovisuales', 'Sonido, pantallas, video y equipos técnicos', 'Proyectores y pantallas de proyección'),
  ('Audiovisuales', 'Sonido, pantallas, video y equipos técnicos', 'Microfonía'),
  ('Audiovisuales', 'Sonido, pantallas, video y equipos técnicos', 'Técnico de sonido'),
  ('Audiovisuales', 'Sonido, pantallas, video y equipos técnicos', 'DJ'),
  ('Audiovisuales', 'Sonido, pantallas, video y equipos técnicos', 'Streaming y transmisión en vivo'),
  ('Audiovisuales', 'Sonido, pantallas, video y equipos técnicos', 'Traducción simultánea'),
  ('Iluminación', 'Luces escénicas, decorativas y efectos', 'Iluminación escénica'),
  ('Iluminación', 'Luces escénicas, decorativas y efectos', 'Iluminación decorativa'),
  ('Iluminación', 'Luces escénicas, decorativas y efectos', 'Técnico de iluminación'),
  ('Iluminación', 'Luces escénicas, decorativas y efectos', 'Efectos especiales (humo, chispas, confeti)'),
  ('Escenografía y montaje', 'Estructuras, tarimas, carpas y montaje', 'Tarimas y escenarios'),
  ('Escenografía y montaje', 'Estructuras, tarimas, carpas y montaje', 'Truss y estructuras'),
  ('Escenografía y montaje', 'Estructuras, tarimas, carpas y montaje', 'Carpas'),
  ('Escenografía y montaje', 'Estructuras, tarimas, carpas y montaje', 'Pisos y alfombras'),
  ('Escenografía y montaje', 'Estructuras, tarimas, carpas y montaje', 'Backings y paneles'),
  ('Escenografía y montaje', 'Estructuras, tarimas, carpas y montaje', 'Montaje y desmontaje'),
  ('Mobiliario y menaje', 'Alquiler de mobiliario, mantelería y vajilla', 'Alquiler de sillas'),
  ('Mobiliario y menaje', 'Alquiler de mobiliario, mantelería y vajilla', 'Alquiler de mesas'),
  ('Mobiliario y menaje', 'Alquiler de mobiliario, mantelería y vajilla', 'Mobiliario lounge'),
  ('Mobiliario y menaje', 'Alquiler de mobiliario, mantelería y vajilla', 'Mantelería'),
  ('Mobiliario y menaje', 'Alquiler de mobiliario, mantelería y vajilla', 'Vajilla y cristalería'),
  ('Decoración', 'Ambientación, flores y decoración temática', 'Arreglos florales'),
  ('Decoración', 'Ambientación, flores y decoración temática', 'Decoración temática'),
  ('Decoración', 'Ambientación, flores y decoración temática', 'Centros de mesa'),
  ('Decoración', 'Ambientación, flores y decoración temática', 'Globos'),
  ('Decoración', 'Ambientación, flores y decoración temática', 'Vinilos y señalética'),
  ('Catering y alimentos', 'Comida y bebida para eventos', 'Buffet'),
  ('Catering y alimentos', 'Comida y bebida para eventos', 'Canapés y picaderas'),
  ('Catering y alimentos', 'Comida y bebida para eventos', 'Coffee break'),
  ('Catering y alimentos', 'Comida y bebida para eventos', 'Bebidas y bar'),
  ('Catering y alimentos', 'Comida y bebida para eventos', 'Bartender'),
  ('Catering y alimentos', 'Comida y bebida para eventos', 'Pastelería y postres'),
  ('Catering y alimentos', 'Comida y bebida para eventos', 'Servicio de meseros'),
  ('Entretenimiento', 'Música en vivo, artistas y animación', 'Músicos y bandas'),
  ('Entretenimiento', 'Música en vivo, artistas y animación', 'Maestro de ceremonias / animador'),
  ('Entretenimiento', 'Música en vivo, artistas y animación', 'Artistas y shows'),
  ('Entretenimiento', 'Música en vivo, artistas y animación', 'Actividades infantiles'),
  ('Fotografía y video', 'Cobertura fotográfica y audiovisual del evento', 'Fotografía'),
  ('Fotografía y video', 'Cobertura fotográfica y audiovisual del evento', 'Video y edición'),
  ('Fotografía y video', 'Cobertura fotográfica y audiovisual del evento', 'Drones'),
  ('Fotografía y video', 'Cobertura fotográfica y audiovisual del evento', 'Cabina de fotos (photobooth)'),
  ('Personal de eventos', 'Personal contratado para el evento', 'Azafatas y protocolo'),
  ('Personal de eventos', 'Personal contratado para el evento', 'Seguridad'),
  ('Personal de eventos', 'Personal contratado para el evento', 'Limpieza'),
  ('Personal de eventos', 'Personal contratado para el evento', 'Coordinación de evento'),
  ('Personal de eventos', 'Personal contratado para el evento', 'Valet parking'),
  ('Transporte y combustible', 'Traslados, fletes y combustible', 'Transporte de invitados'),
  ('Transporte y combustible', 'Traslados, fletes y combustible', 'Flete de equipos'),
  ('Transporte y combustible', 'Traslados, fletes y combustible', 'Alquiler de vehículos'),
  ('Transporte y combustible', 'Traslados, fletes y combustible', 'Combustible'),
  ('Locales y venues', 'Alquiler de salones y espacios para eventos', 'Alquiler de salón'),
  ('Locales y venues', 'Alquiler de salones y espacios para eventos', 'Alquiler de espacio exterior'),
  ('Impresos y promocionales', 'Invitaciones, material impreso y merchandising', 'Invitaciones'),
  ('Impresos y promocionales', 'Invitaciones, material impreso y merchandising', 'Banners y roll-ups'),
  ('Impresos y promocionales', 'Invitaciones, material impreso y merchandising', 'Credenciales y gafetes'),
  ('Impresos y promocionales', 'Invitaciones, material impreso y merchandising', 'Merchandising'),
  ('Logística y servicios', 'Servicios de apoyo para montar y operar el evento', 'Plantas eléctricas'),
  ('Logística y servicios', 'Servicios de apoyo para montar y operar el evento', 'Baños portátiles'),
  ('Logística y servicios', 'Servicios de apoyo para montar y operar el evento', 'Climatización'),
  ('Logística y servicios', 'Servicios de apoyo para montar y operar el evento', 'Registro y acreditación'),
  ('Logística y servicios', 'Servicios de apoyo para montar y operar el evento', 'Internet y WiFi'),
  ('Logística y servicios', 'Servicios de apoyo para montar y operar el evento', 'Permisos y licencias'),
  ('Hospedaje y viajes', 'Hoteles, boletos y viáticos', 'Hoteles'),
  ('Hospedaje y viajes', 'Hoteles, boletos y viáticos', 'Boletos aéreos'),
  ('Hospedaje y viajes', 'Hoteles, boletos y viáticos', 'Viáticos');

-- Categorías que falten
insert into public.expense_categories (company_id, name, description)
select distinct on (c.id, t.category) c.id, t.category, t.description
from public.companies c
cross join tmp_event_catalog t
where not exists (
  select 1 from public.expense_categories ec
  where ec.company_id = c.id
    and lower(translate(ec.name, 'áéíóúÁÉÍÓÚ', 'aeiouAEIOU')) = lower(translate(t.category, 'áéíóúÁÉÍÓÚ', 'aeiouAEIOU'))
);

-- Tipos de servicio que falten
insert into public.supplier_service_types (company_id, category_id, name)
select c.id, public.find_expense_category(c.id, t.category), t.service_type
from public.companies c
cross join tmp_event_catalog t
where public.find_expense_category(c.id, t.category) is not null
  and not exists (
    select 1 from public.supplier_service_types st
    where st.company_id = c.id
      and st.category_id = public.find_expense_category(c.id, t.category)
      and lower(translate(st.name, 'áéíóúÁÉÍÓÚ', 'aeiouAEIOU')) = lower(translate(t.service_type, 'áéíóúÁÉÍÓÚ', 'aeiouAEIOU'))
  )
on conflict do nothing;

drop table if exists tmp_event_catalog;
