-- Catálogo de categorías y tipos de servicio (2026-09-29), a pedido del usuario:
-- dejar Configuración → Categorías / Tipos de servicio igual al archivo
-- categorias-y-tipos-de-servicio_1.csv (81 categorías, 176 tipos).
-- Cambios sobre lo existente (confirmados por el usuario):
--   * Renombres: Decoracion → Decoración, Locales y venues → Locales para eventos,
--     Coffee break → Pausa de café, Merchandising → Artículos promocionales.
--   * Descripciones de Audiovisuales y Decoración.
--   * Fotografia → su gasto y movimientos pasan a "Fotografía y video"; se borra.
--   * Incendio (prueba) → sus proveedores pasan a Salud y emergencias /
--     Prevención de incendios; se borran Incendio y el tipo nghnghn.
-- Todo en una transacción; se puede correr más de una vez.

begin;

do $$
declare
  v_company uuid;
  v_foto uuid; v_fyv uuid; v_inc uuid; v_salud uuid; v_prev uuid;
begin
  select company_id into v_company from public.expense_categories where name = 'Audiovisuales' limit 1;
  if v_company is null then raise exception 'No se encontró la empresa'; end if;

  -- 1) Renombres y descripciones
  update public.expense_categories set name = 'Decoración', description = 'Decoración de eventos'
   where company_id = v_company and name = 'Decoracion';
  update public.expense_categories set description = 'Audio, pantallas, proyección y transmisión para eventos'
   where company_id = v_company and name = 'Audiovisuales';
  update public.expense_categories set name = 'Locales para eventos'
   where company_id = v_company and name = 'Locales y venues';
  update public.supplier_service_types set name = 'Pausa de café'
   where company_id = v_company and name = 'Coffee break';
  update public.supplier_service_types set name = 'Artículos promocionales'
   where company_id = v_company and name = 'Merchandising';

  -- 2) Categorías nuevas
  insert into public.expense_categories (company_id, name, description)
  select v_company, c.name, c.description
  from (values
    ('Alquiler', 'Alquiler de local, almacén u oficina'),
    ('Alquiler de equipos', 'Sonido, luces, tarimas, mobiliario'),
    ('Anticipo de cliente', 'Adelantos recibidos antes de facturar'),
    ('Audiovisuales', 'Audio, pantallas, proyección y transmisión para eventos'),
    ('Catering y alimentos', 'Comida y bebida para eventos'),
    ('Cobro de factura', 'Cobros a clientes por facturas emitidas'),
    ('Comisión', 'Comisiones cobradas o pagadas'),
    ('Comisiones bancarias', 'Cargos y comisiones del banco'),
    ('Decoración', 'Decoración de eventos'),
    ('Entretenimiento', 'Música en vivo, artistas y animación'),
    ('Escenografía y montaje', 'Estructuras, tarimas, carpas y montaje'),
    ('Factura cliente', 'Cobro a Cliente de un Servicio o producto vendido'),
    ('Fotografía y video', 'Cobertura fotográfica y audiovisual del evento'),
    ('Gastos administrativos', 'Papelería, oficina y gastos generales'),
    ('Gastos de representación', 'Comidas, atenciones y gastos con clientes'),
    ('Honorarios profesionales', 'Contadores, abogados, consultores'),
    ('Hospedaje y viajes', 'Hoteles, boletos y viáticos'),
    ('Iluminación', 'Luces escénicas, decorativas y efectos'),
    ('Impresos y promocionales', 'Invitaciones, material impreso y merchandising'),
    ('Impuestos', 'ITBIS, ISR, anticipos y otros impuestos'),
    ('Intereses bancarios', 'Intereses ganados o pagados'),
    ('Locales para eventos', 'Alquiler de salones y espacios para eventos'),
    ('Logística y servicios', 'Servicios de apoyo para montar y operar el evento'),
    ('Mantenimiento y reparaciones', 'Arreglos de equipos, vehículos o local'),
    ('Mobiliario y menaje', 'Alquiler de mobiliario, mantelería y vajilla'),
    ('Nómina', 'Salarios, bonos y pagos al personal'),
    ('Otros gastos', 'Egresos que no encajan en otra categoría'),
    ('Otros ingresos', 'Ingresos que no encajan en otra categoría'),
    ('Pago a suplidor', 'Pagos a proveedores cuando el gasto no tiene categoría'),
    ('Pago de tarjeta de crédito', 'Pagos hechos a tarjetas de crédito'),
    ('Personal de eventos', 'Personal contratado para el evento'),
    ('Préstamos', 'Desembolsos y pagos de préstamos'),
    ('Publicidad y mercadeo', 'Anuncios, redes sociales, material promocional'),
    ('Reembolso', 'Devoluciones de dinero recibidas o hechas'),
    ('Seguros', 'Pólizas y seguros'),
    ('Servicios', 'Ingresos o pagos por servicios'),
    ('Servicios públicos', 'Luz, agua, teléfono e internet'),
    ('Transferencia entre cuentas', 'Movimientos entre cuentas propias'),
    ('Transporte y combustible', 'Traslados, fletes y combustible'),
    ('Ventas', 'Ingresos por venta de productos o eventos'),
    ('Producción y planificación', 'Diseño, planificación y dirección de la producción del evento'),
    ('Diseño y contenido', 'Creación visual y contenido para la experiencia del evento'),
    ('Tecnología de eventos', 'Plataformas y herramientas digitales para operar eventos'),
    ('Salud y emergencias', 'Atención sanitaria y respuesta a emergencias en eventos'),
    ('Accesibilidad', 'Servicios de inclusión y acceso para asistentes'),
    ('Ceremonias', 'Servicios especializados para bodas y ceremonias'),
    ('Belleza y vestuario', 'Preparación de imagen y vestuario para participantes del evento'),
    ('Activaciones de marca', 'Experiencias promocionales y exhibiciones para marcas'),
    ('Suministros de eventos', 'Materiales consumibles para la operación de eventos'),
    ('Aportes a la seguridad social', 'Aportes y pagos de obligaciones ante la TSS'),
    ('Beneficios al personal', 'Beneficios, incentivos y apoyos adicionales a la nómina'),
    ('Capacitación', 'Cursos y formación del personal de la empresa'),
    ('Reclutamiento', 'Selección, evaluación y contratación de personal'),
    ('Uniformes', 'Compra y confección de uniformes del personal'),
    ('Software y suscripciones', 'Licencias y suscripciones de sistemas y aplicaciones'),
    ('Servicios de tecnología', 'Soporte informático, alojamiento web y servicios tecnológicos'),
    ('Seguridad de instalaciones', 'Vigilancia, alarmas y controles de seguridad de oficina y almacén'),
    ('Limpieza de instalaciones', 'Limpieza, fumigación e higiene de oficina y almacén'),
    ('Materiales de oficina', 'Papelería, insumos y consumibles administrativos'),
    ('Compras de inventario', 'Compra de productos y materiales destinados a la venta'),
    ('Compra de activos', 'Adquisición de equipos, mobiliario, vehículos y otros activos'),
    ('Importaciones y aduanas', 'Costos y cargos de importación y despacho aduanero'),
    ('Gastos legales y registrales', 'Trámites, certificaciones y registros empresariales'),
    ('Membresías y afiliaciones', 'Cuotas de asociaciones, cámaras y organizaciones'),
    ('Donaciones', 'Aportes y donaciones realizados por la empresa'),
    ('Multas y recargos', 'Penalidades, multas y recargos pagados'),
    ('Depósitos en garantía', 'Garantías entregadas o recibidas y su devolución'),
    ('Anticipo a suplidor', 'Adelantos entregados a proveedores antes de liquidar sus servicios'),
    ('Devolución a cliente', 'Dinero devuelto a clientes por cancelaciones o ajustes'),
    ('Devolución de suplidor', 'Dinero recibido de proveedores por devoluciones o ajustes'),
    ('Aportes de capital', 'Aportes de socios o accionistas al capital de la empresa'),
    ('Distribución de utilidades', 'Pagos de dividendos o utilidades a socios y accionistas'),
    ('Caja chica', 'Fondos y reposiciones para gastos menores'),
    ('Retiro de efectivo', 'Retiros bancarios para disponibilidad de efectivo'),
    ('Depósito de efectivo', 'Depósitos de efectivo en cuentas bancarias'),
    ('Cambio de moneda', 'Compra y venta de divisas'),
    ('Inversiones financieras', 'Colocaciones y rescates de inversiones financieras'),
    ('Saldo inicial', 'Registro de saldos al iniciar el uso del sistema'),
    ('Ajustes bancarios', 'Correcciones y ajustes de conciliación bancaria'),
    ('Anticipos al personal', 'Adelantos y préstamos entregados al personal'),
    ('Recuperación de anticipos', 'Cobros de adelantos y préstamos otorgados al personal')
  ) as c(name, description)
  where not exists (
    select 1 from public.expense_categories ec
    where ec.company_id = v_company and public.catalog_key(ec.name) = public.catalog_key(c.name)
  );

  -- 3) Tipos de servicio nuevos
  insert into public.supplier_service_types (company_id, category_id, name)
  select v_company, ec.id, t.name
  from (values
    ('Audiovisuales', 'Audio y Sonido'),
    ('Catering y alimentos', 'Bartender'),
    ('Catering y alimentos', 'Bebidas y bar'),
    ('Catering y alimentos', 'Buffet'),
    ('Catering y alimentos', 'Canapés y picaderas'),
    ('Catering y alimentos', 'Pausa de café'),
    ('Catering y alimentos', 'Pastelería y postres'),
    ('Catering y alimentos', 'Servicio de meseros'),
    ('Decoración', 'Arreglos florales'),
    ('Decoración', 'Centros de mesa'),
    ('Decoración', 'Decoración temática'),
    ('Decoración', 'Globos'),
    ('Decoración', 'Vinilos y señalética'),
    ('Entretenimiento', 'Actividades infantiles'),
    ('Entretenimiento', 'Artistas y shows'),
    ('Entretenimiento', 'Maestro de ceremonias / animador'),
    ('Entretenimiento', 'Músicos y bandas'),
    ('Escenografía y montaje', 'Backings y paneles'),
    ('Escenografía y montaje', 'Carpas'),
    ('Escenografía y montaje', 'Montaje y desmontaje'),
    ('Escenografía y montaje', 'Pisos y alfombras'),
    ('Escenografía y montaje', 'Tarimas y escenarios'),
    ('Escenografía y montaje', 'Truss y estructuras'),
    ('Fotografía y video', 'Cabina de fotos (photobooth)'),
    ('Fotografía y video', 'Drones'),
    ('Fotografía y video', 'Fotografía'),
    ('Fotografía y video', 'Video y edición'),
    ('Hospedaje y viajes', 'Boletos aéreos'),
    ('Hospedaje y viajes', 'Hoteles'),
    ('Hospedaje y viajes', 'Viáticos'),
    ('Iluminación', 'Efectos especiales (humo, chispas, confeti)'),
    ('Iluminación', 'Iluminación decorativa'),
    ('Iluminación', 'Iluminación escénica'),
    ('Iluminación', 'Técnico de iluminación'),
    ('Impresos y promocionales', 'Banners y roll-ups'),
    ('Impresos y promocionales', 'Credenciales y gafetes'),
    ('Impresos y promocionales', 'Invitaciones'),
    ('Impresos y promocionales', 'Artículos promocionales'),
    ('Locales para eventos', 'Alquiler de espacio exterior'),
    ('Locales para eventos', 'Alquiler de salón'),
    ('Logística y servicios', 'Baños portátiles'),
    ('Logística y servicios', 'Climatización'),
    ('Logística y servicios', 'Internet y WiFi'),
    ('Logística y servicios', 'Permisos y licencias'),
    ('Logística y servicios', 'Plantas eléctricas'),
    ('Logística y servicios', 'Registro y acreditación'),
    ('Mobiliario y menaje', 'Alquiler de mesas'),
    ('Mobiliario y menaje', 'Alquiler de sillas'),
    ('Mobiliario y menaje', 'Mantelería'),
    ('Mobiliario y menaje', 'Mobiliario lounge'),
    ('Mobiliario y menaje', 'Vajilla y cristalería'),
    ('Personal de eventos', 'Azafatas y protocolo'),
    ('Personal de eventos', 'Coordinación de evento'),
    ('Personal de eventos', 'Limpieza'),
    ('Personal de eventos', 'Seguridad'),
    ('Personal de eventos', 'Valet parking'),
    ('Transporte y combustible', 'Alquiler de vehículos'),
    ('Transporte y combustible', 'Combustible'),
    ('Transporte y combustible', 'Flete de equipos'),
    ('Transporte y combustible', 'Transporte de invitados'),
    ('Audiovisuales', 'Alquiler de pantallas LED'),
    ('Audiovisuales', 'Alquiler de proyectores'),
    ('Audiovisuales', 'Alquiler de televisores'),
    ('Audiovisuales', 'Transmisión en vivo'),
    ('Audiovisuales', 'Realización multicámara'),
    ('Audiovisuales', 'Operación de video'),
    ('Audiovisuales', 'Microfonía'),
    ('Audiovisuales', 'Interpretación simultánea'),
    ('Audiovisuales', 'Sistemas de presentación'),
    ('Alquiler de equipos', 'Alquiler de radios'),
    ('Alquiler de equipos', 'Alquiler de herramientas'),
    ('Alquiler de equipos', 'Alquiler de elevadores'),
    ('Catering y alimentos', 'Menús servidos'),
    ('Catering y alimentos', 'Estaciones gastronómicas'),
    ('Catering y alimentos', 'Alimentación de equipo'),
    ('Decoración', 'Telas y cortinajes'),
    ('Decoración', 'Decoración de ceremonia'),
    ('Decoración', 'Diseño floral'),
    ('Decoración', 'Ambientación de espacios'),
    ('Entretenimiento', 'Disc jockey'),
    ('Entretenimiento', 'Grupos de baile'),
    ('Entretenimiento', 'Espectáculos de magia'),
    ('Entretenimiento', 'Animación interactiva'),
    ('Entretenimiento', 'Comparsas'),
    ('Entretenimiento', 'Personajes temáticos'),
    ('Escenografía y montaje', 'Diseño escenográfico'),
    ('Escenografía y montaje', 'Fabricación de escenografía'),
    ('Escenografía y montaje', 'Gradas y plataformas'),
    ('Escenografía y montaje', 'Barreras y vallas'),
    ('Fotografía y video', 'Fotografía de producto'),
    ('Fotografía y video', 'Grabación de conciertos'),
    ('Fotografía y video', 'Álbumes fotográficos'),
    ('Fotografía y video', 'Retrato corporativo'),
    ('Hospedaje y viajes', 'Agencia de viajes'),
    ('Hospedaje y viajes', 'Gestión de alojamiento'),
    ('Hospedaje y viajes', 'Traslados aeroportuarios'),
    ('Iluminación', 'Iluminación arquitectónica'),
    ('Iluminación', 'Diseño de iluminación'),
    ('Iluminación', 'Sistemas láser'),
    ('Iluminación', 'Seguidores de luz'),
    ('Impresos y promocionales', 'Impresión de programas'),
    ('Impresos y promocionales', 'Impresión de catálogos'),
    ('Impresos y promocionales', 'Empaques personalizados'),
    ('Impresos y promocionales', 'Regalos corporativos'),
    ('Impresos y promocionales', 'Impresión de boletos'),
    ('Impresos y promocionales', 'Rotulación de vehículos'),
    ('Locales para eventos', 'Alquiler de teatro'),
    ('Locales para eventos', 'Alquiler de estadio'),
    ('Locales para eventos', 'Alquiler de finca'),
    ('Locales para eventos', 'Alquiler de playa'),
    ('Locales para eventos', 'Alquiler de restaurante'),
    ('Locales para eventos', 'Alquiler de estudio'),
    ('Logística y servicios', 'Distribución eléctrica'),
    ('Logística y servicios', 'Gestión de estacionamiento'),
    ('Logística y servicios', 'Almacenaje de evento'),
    ('Logística y servicios', 'Gestión de residuos'),
    ('Mobiliario y menaje', 'Barras y estaciones'),
    ('Mobiliario y menaje', 'Cubertería'),
    ('Mobiliario y menaje', 'Sombrillas'),
    ('Mobiliario y menaje', 'Podios y atriles'),
    ('Mobiliario y menaje', 'Accesorios de mesa'),
    ('Personal de eventos', 'Asistentes de producción'),
    ('Personal de eventos', 'Cargadores'),
    ('Personal de eventos', 'Técnicos de sonido'),
    ('Personal de eventos', 'Operadores de pantallas'),
    ('Personal de eventos', 'Supervisión de accesos'),
    ('Transporte y combustible', 'Transporte de artistas'),
    ('Transporte y combustible', 'Transporte de personal'),
    ('Transporte y combustible', 'Mensajería'),
    ('Transporte y combustible', 'Alquiler de camiones'),
    ('Transporte y combustible', 'Transporte marítimo'),
    ('Transporte y combustible', 'Transporte aéreo de carga'),
    ('Producción y planificación', 'Diseño de evento'),
    ('Producción y planificación', 'Dirección de producción'),
    ('Producción y planificación', 'Producción técnica'),
    ('Producción y planificación', 'Planificación de bodas'),
    ('Producción y planificación', 'Gestión de proveedores'),
    ('Producción y planificación', 'Gestión de artistas'),
    ('Producción y planificación', 'Dirección de escenario'),
    ('Diseño y contenido', 'Diseño gráfico'),
    ('Diseño y contenido', 'Animación digital'),
    ('Diseño y contenido', 'Modelado tridimensional'),
    ('Diseño y contenido', 'Contenido para pantallas'),
    ('Diseño y contenido', 'Mapeo de proyección'),
    ('Diseño y contenido', 'Redacción de guiones'),
    ('Diseño y contenido', 'Diseño de invitaciones digitales'),
    ('Tecnología de eventos', 'Venta de entradas'),
    ('Tecnología de eventos', 'Aplicaciones de eventos'),
    ('Tecnología de eventos', 'Votación interactiva'),
    ('Tecnología de eventos', 'Gestión de asistentes'),
    ('Tecnología de eventos', 'Experiencias de realidad virtual'),
    ('Tecnología de eventos', 'Experiencias de realidad aumentada'),
    ('Salud y emergencias', 'Servicio de ambulancia'),
    ('Salud y emergencias', 'Atención de primeros auxilios'),
    ('Salud y emergencias', 'Personal médico'),
    ('Salud y emergencias', 'Prevención de incendios'),
    ('Accesibilidad', 'Interpretación de lengua de señas'),
    ('Accesibilidad', 'Subtitulado en vivo'),
    ('Accesibilidad', 'Audiodescripción'),
    ('Accesibilidad', 'Alquiler de rampas'),
    ('Ceremonias', 'Oficiantes de ceremonia'),
    ('Ceremonias', 'Organización de cortejo'),
    ('Ceremonias', 'Asesoría ceremonial'),
    ('Belleza y vestuario', 'Maquillaje'),
    ('Belleza y vestuario', 'Peinado'),
    ('Belleza y vestuario', 'Estilismo'),
    ('Belleza y vestuario', 'Alquiler de vestuario'),
    ('Belleza y vestuario', 'Confección de vestuario'),
    ('Activaciones de marca', 'Diseño de activaciones'),
    ('Activaciones de marca', 'Producción de exhibidores'),
    ('Activaciones de marca', 'Demostraciones de producto'),
    ('Activaciones de marca', 'Muestreo promocional'),
    ('Suministros de eventos', 'Materiales de montaje'),
    ('Suministros de eventos', 'Desechables para eventos'),
    ('Suministros de eventos', 'Hielo para eventos'),
    ('Suministros de eventos', 'Artículos de celebración')
  ) as t(category, name)
  join public.expense_categories ec
    on ec.company_id = v_company and public.catalog_key(ec.name) = public.catalog_key(t.category)
  where not exists (
    select 1 from public.supplier_service_types st
    where st.company_id = v_company and public.catalog_key(st.name) = public.catalog_key(t.name)
  );

  -- 4) Fotografia → Fotografía y video
  select id into v_foto from public.expense_categories where company_id = v_company and name = 'Fotografia';
  select id into v_fyv from public.expense_categories where company_id = v_company and name = 'Fotografía y video';
  if v_foto is not null and v_fyv is not null then
    update public.expenses set category_id = v_fyv where category_id = v_foto;
    update public.bank_transactions set category_id = v_fyv where category_id = v_foto;
    update public.suppliers set category_id = v_fyv, service_type_id = null, service_type = null where category_id = v_foto;
    delete from public.expense_categories where id = v_foto;
  end if;

  -- 5) Incendio (prueba) → Salud y emergencias / Prevención de incendios
  select id into v_inc from public.expense_categories where company_id = v_company and name = 'Incendio';
  select id into v_salud from public.expense_categories where company_id = v_company and name = 'Salud y emergencias';
  select id into v_prev from public.supplier_service_types where company_id = v_company and name = 'Prevención de incendios';
  if v_inc is not null then
    update public.suppliers set category_id = v_salud, service_type_id = v_prev where category_id = v_inc;
    update public.expenses set category_id = v_salud where category_id = v_inc;
    update public.bank_transactions set category_id = v_salud where category_id = v_inc;
    delete from public.supplier_service_types where category_id = v_inc;
    delete from public.expense_categories where id = v_inc;
  end if;

  -- 6) Textos del proveedor iguales a los nombres del catálogo
  update public.suppliers s set category = c.name
    from public.expense_categories c where s.category_id = c.id and s.category is distinct from c.name;
  update public.suppliers s set service_type = st.name
    from public.supplier_service_types st where s.service_type_id = st.id and s.service_type is distinct from st.name;

  insert into public.audit_logs (company_id, user_id, action, entity_type, entity_id, new_values)
  values (v_company, (select id from public.profiles where email = 'adiaz@mindfreakevents.com' limit 1),
          'IMPORT', 'expense_category', v_company,
          jsonb_build_object('source', 'categorias-y-tipos-de-servicio_1.csv', 'note', 'Catálogo igualado al archivo (Claude, 2026-09-29)'));
end $$;

commit;
