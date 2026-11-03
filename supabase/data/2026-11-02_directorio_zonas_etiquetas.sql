-- 2-nov-2026 — Directorio: más zonas (todas las provincias de RD) y etiquetas del negocio de eventos.
-- Solo agrega (no borra ni cambia nada). Si el nombre ya existe en la compañía, se salta.
-- Se conservan en la limpieza Go-Live (son listas de Configuración → Directorio).

insert into public.directory_zones (company_id, name)
select c.id, z.name from public.companies c
cross join (values
  ('Azua'), ('Bahoruco (Neiba)'), ('Barahona'), ('Dajabón'), ('Duarte (San Francisco de Macorís)'),
  ('El Seibo'), ('Elías Piña'), ('Espaillat (Moca)'), ('Hato Mayor'), ('Hermanas Mirabal (Salcedo)'),
  ('Independencia (Jimaní)'), ('La Altagracia (Higüey)'), ('La Vega'), ('María Trinidad Sánchez (Nagua)'),
  ('Monseñor Nouel (Bonao)'), ('Monte Cristi'), ('Monte Plata'), ('Pedernales'), ('Peravia (Baní)'),
  ('San Cristóbal'), ('San José de Ocoa'), ('San Juan'), ('San Pedro de Macorís'), ('Sánchez Ramírez (Cotuí)'),
  ('Santiago Rodríguez'), ('Valverde (Mao)'), ('Boca Chica'), ('Las Terrenas'), ('Cabarete / Sosúa'),
  ('Fuera del país')
) as z(name)
on conflict do nothing;

insert into public.directory_tags (company_id, name)
select c.id, t.name from public.companies c
cross join (values
  -- Tipo de evento
  ('Graduaciones'), ('Quinceañeras'), ('Cumpleaños'), ('Baby shower'), ('Aniversarios'),
  ('Activaciones de marca'), ('Ferias y exposiciones'), ('Conciertos'), ('Festivales'),
  ('Galas y premiaciones'), ('Team building'), ('Fiestas de fin de año'), ('Seminarios y talleres'),
  ('Eventos deportivos'), ('Virtual / híbrido'), ('Gubernamental'), ('Religioso'),
  -- Lugar y alcance
  ('Hoteles y resorts'), ('Viaja fuera de Santo Domingo'), ('Gran capacidad'),
  -- Cómo trabaja
  ('Último minuto'), ('Disponible 24/7'), ('Emite factura con NCF'), ('Acepta pago a crédito'),
  ('Trae su propio equipo'), ('Montaje incluido'), ('Recomendado por un cliente')
) as t(name)
on conflict do nothing;
