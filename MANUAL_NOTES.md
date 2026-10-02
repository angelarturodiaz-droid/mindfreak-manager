# Notas para el Manual de Usuario (a construir al finalizar el sistema)

Este archivo acumula explicaciones, aclaraciones y decisiones de producto
que deben quedar reflejadas en el manual de usuario final — módulo por
módulo, con el flujo completo. No es el manual en sí, es el material en
crudo para no perder estas explicaciones mientras el sistema sigue en
construcción.

---

## Módulo: Facturación y Cobros

### ¿Para qué sirve el Recibo de Cobro? (distinto de la Factura)

- **Factura** = "Esto es lo que me debes" (una obligación de pago).
- **Recibo de Cobro** = "Confirmo que ya me pagaste esto" (una prueba de pago).

Se usa sobre todo cuando el pago es parcial (ej. "50% anticipo, 50% al
finalizar", común en cotizaciones de eventos): cada abono que el cliente
transfiere genera su propio Recibo de Cobro — con fecha, monto, método y
el balance que queda pendiente en la factura — sin tener que reemitir ni
modificar la factura original.

Para qué le sirve al cliente en la práctica:
- Su propia contabilidad: muchas empresas necesitan un comprobante para
  registrar el gasto/pago en sus propios libros, no solo la factura del
  proveedor.
- Evitar disputas: si después hay duda de "¿ya pagué el anticipo o no?",
  el recibo con fecha y monto lo resuelve al instante.
- Reembolsos internos: si quien paga es un empleado de otra empresa con
  fondos corporativos, necesita el recibo para que se lo reembolsen.

Lo mismo aplica en espejo con el **Comprobante de Pago a Proveedor** — es
la prueba de que ya se le pagó a un proveedor, útil ante cualquier reclamo
de que no se pagó, o para control interno propio.

En resumen: factura y recibo casi siempre van juntos en un flujo de pagos
parciales — la factura no cambia, pero cada abono genera su propio recibo.

---

## Módulo: Configuración → Usuarios

### MFA (autenticación de dos factores) — pendiente, opciones evaluadas

Supabase Auth soporta MFA nativo con dos métodos:
- **TOTP (app autenticadora — Google Authenticator, Authy, etc.)**:
  gratis, no depende de que llegue un SMS. **Recomendado como método
  principal.**
- **SMS/WhatsApp**: tiene costo por mensaje y depende del operador.

Cuando se construya, lo ideal es TOTP obligatorio para roles sensibles
(Administrador, Finanzas) y opcional para el resto, con SMS como
alternativa si el negocio lo pide.

### Crear usuarios: directo, sin invitación por correo

A diferencia de otros sistemas que mandan un correo de invitación, aquí el
administrador crea la cuenta directo desde Configuración → Usuarios, con
una contraseña temporal que él mismo define o genera — la cuenta queda
activa al instante, sin esperar a que el usuario confirme un correo. La
contraseña temporal se comparte con la persona por un canal seguro
(WhatsApp, en persona, etc.) y ella puede cambiarla después desde su
propia cuenta.

---

## Módulo: Cotizaciones y Facturas → Condiciones de pago

### ¿Con qué condición de pago sale una factura nueva?

Depende de cómo se crea la factura:

- **Factura creada desde cero** (sin proyecto de por medio, "Cliente
  directo"): el selector de Condición de pago sale en **"Sin
  especificar"** por defecto — el usuario elige cuál quiere. Si no elige
  ninguna, la factura funciona igual que antes de este módulo (el
  vencimiento se escribe a mano).
- **Factura creada desde un Proyecto que viene de una Cotización
  aprobada**: se coloca sola **la misma condición que tenía esa
  cotización** (la que se "congeló" cuando se creó la cotización, no una
  condición por defecto inventada). Ejemplo: si la cotización se hizo con
  "Crédito 30 días", la factura sale con esa misma condición ya
  seleccionada y el vencimiento ya calculado. **Se puede cambiar** en el
  mismo formulario si esa factura en particular necesita una condición
  distinta a la de la cotización original.

### ¿Cómo se calcula el vencimiento?

`Fecha de vencimiento = Fecha de emisión + Días de crédito de la condición
elegida`. Se recalcula solo si se cambia la fecha de emisión. Si no hay
ninguna condición de pago seleccionada, el vencimiento se sigue escribiendo
a mano, como siempre.

### ¿Los valores del catálogo cambian facturas/cotizaciones ya hechas?

No. Al elegir una condición de pago, sus valores (días de crédito, %
anticipo/saldo, forma de pago) quedan "congelados" en esa cotización o
factura específica — igual que ya pasa con la tasa de cambio. Si después
se edita o desactiva esa condición en el catálogo (Configuración →
Condiciones de pago), los documentos ya creados no se alteran.

---

<!-- Agregar aquí nuevas notas a medida que surjan, con su propio ## encabezado de módulo -->

---

## Módulo: Bancos — Tipo y Categoría de cada movimiento (2026-09-23)

Decisión del usuario: este esquema reemplaza la clasificación manual que
llevaba en Excel. Objetivo: poder analizar ingresos y egresos agrupados
por categoría.

- **Tipo y Categoría son independientes.** Tipo = Ingreso / Egreso /
  Transferencia (define si el dinero entra, sale o se mueve entre cuentas
  propias). Categoría = de dónde viene o en qué se usó.
- **Las categorías NO tienen tipo.** Una misma categoría puede usarse en
  ingresos y en egresos (ej. "Comisión" cobrada o pagada). Es una sola
  lista, la misma que usan los gastos (Configuración → Categorías).
- **Categoría automática según el origen**:
  - Cobro de factura → "Cobro de factura".
  - Pago a proveedor / gasto pagado → hereda la categoría del gasto
    (Catering, Sonido, Alquiler…), para que el reporte muestre en qué se
    usó el dinero. Si el gasto no tiene categoría: "Pago a suplidor" /
    "Otros gastos".
  - Transferencia con una tarjeta de crédito → "Pago de tarjeta de crédito";
    otra transferencia → "Transferencia entre cuentas".
- **"Sin categoría" se permite temporalmente** (casos excepcionales) para
  no bloquear una operación bancaria. Se muestra una alerta
  "⚠️ N movimientos sin categoría" en Bancos y en cada cuenta, con enlace
  para clasificarlos, y aparece como fila propia en el reporte.
- **Movimientos manuales**: se elige la categoría de un desplegable; si se
  deja "Sin categoría", la descripción es obligatoria. Campo "Referencia"
  opcional para número de cheque / transacción.
- **Transferencias**: las dos filas (salida y entrada) quedan enlazadas y
  cada una sabe cuál es la otra cuenta.
- **Reporte "Ingresos y egresos por categoría"** (Reportes → Bancos): las
  transferencias se excluyen por defecto porque son movimientos entre
  cuentas propias (no son ingreso ni gasto); hay una casilla para
  incluirlas cuando se quiera ver todo el movimiento bancario.
- Limitación conocida: movimientos manuales y transferencias se guardan
  con tasa 1; en cuentas en dólares el reporte no los convierte a pesos.

## General: fecha por defecto

Todos los formularios con fecha de la operación (factura, cotización,
gasto, cobro, pago, movimiento de banco, cuenta nueva) traen la fecha de
hoy en hora de República Dominicana. Antes se calculaba en UTC y después
de las 8:00 p. m. aparecía la fecha del día siguiente.

## General: listados

Todos los listados muestran tarjetas de resumen, filtros por estado con
su conteo, filtro por cliente donde aplica y paginación de 25 registros
(los filtros se conservan al cambiar de página).

## Módulo: Bancos — Transferencias, pago de tarjetas y monedas (2026-09-23)

- "Transferir o pagar tarjeta" mueve dinero desde la cuenta abierta hacia
  otra cuenta o tarjeta activa. La cuenta destino lista todas las demás
  cuentas activas (nunca la actual): si solo aparece una, es porque solo
  hay dos cuentas activas. Las tarjetas se crean en Bancos → Nueva cuenta
  o tarjeta (tipo Tarjeta de crédito).
- Pagar una tarjeta = transferir desde el banco a la tarjeta: el banco
  baja y la deuda de la tarjeta baja. No es ingreso ni gasto.
- Monedas distintas: se pide la tasa (pesos por 1 dólar). Sale el monto
  en la moneda de origen y entra el convertido en la de destino (ej.
  RD$5,950 a 59.50 → US$100). Cada fila guarda su tasa para los reportes.
  Una de las dos cuentas debe estar en la moneda base. Migración 060.
- Tarjetas con balance en dos monedas: se registran como dos tarjetas
  (una DOP y una USD), cada una con su deuda y límite.

## Módulo: Bancos — Conciliación

Conciliar = comparar cada movimiento del sistema contra el estado de
cuenta real del banco y marcar los confirmados (misma fecha y monto). No
cambia montos ni balances. Sirve para detectar cobros que no llegaron,
montos mal digitados, duplicados y cargos del banco sin registrar.
Proceso sugerido mensual: abrir el estado de cuenta, filtrar "Sin
conciliar", marcar lo que coincide, investigar lo que sobra en el
sistema y registrar como movimiento manual lo que falta. Al final el
balance del sistema debe igualar el saldo final del banco. Se puede
desmarcar. Permiso banks.reconcile.

## Módulo: Bancos — Cuentas en dólares y tipo de cuenta (2026-09-23)

- Se pueden crear cuentas en USD (Bancos → Nueva cuenta o tarjeta →
  Moneda USD). La moneda no se puede cambiar después de crear la cuenta.
- Tipo de cuenta: Ahorros o Corriente (solo cuentas bancarias; las
  tarjetas no lo usan). Es informativo: no cambia balances ni cálculos.
  Filtros por tipo y por moneda en la lista de Bancos. Las cuentas
  anteriores quedan "sin indicar" hasta editarlas. Migración 061.
- Movimientos manuales en cuentas que no están en pesos: se pide la tasa
  (pesos por 1 dólar) y se guarda en el movimiento, para que los reportes
  lo conviertan correctamente (antes se guardaban con tasa 1).

## Módulo: Facturas — Emitir vs. enviar (2026-09-23)

- Las facturas no tienen estado "Enviada". Borrador = se arma y corrige;
  "Emitir factura" = se oficializa (no se edita, corre el vencimiento,
  entra en Por cobrar y acepta cobros). Para mandarla al cliente: botón
  Compartir o PDF, después de emitir.
- Diferencia con cotizaciones: la cotización sí pasa por "Enviada" porque
  el cliente debe aceptarla; la factura ya es un cobro acordado.
- Botón "Marcar como enviada al cliente" (2026-09-27): en facturas ya
  emitidas (Emitida, Pago parcial, Pagada o Vencida). Guarda fecha, hora
  y usuario; el detalle muestra "Enviada al cliente el … por …" y la
  lista un sobre verde junto al número. Es solo una marca de control para
  la gestión de cobro: NO cambia el estado. "Quitar marca de enviada" la
  borra si fue un error. No aparece en borradores ni canceladas.

## Módulo: Cobros — Categoría del cobro (2026-09-27)

- El formulario "Registrar cobro" (detalle de la factura) tiene el campo
  Categoría, con "Cobro de factura" seleccionada por defecto.
- Para un cobro normal se deja así. Se cambia cuando el dinero debe
  clasificarse distinto: Anticipo de cliente, Servicios, Reembolso…
- Solo afecta la clasificación en Bancos y en el reporte "Ingresos y
  egresos por categoría". Monto, balance y estado de la factura no cambian.
- Después se puede cambiar en Bancos con el selector de la fila.
- Pagos a proveedores: sin campo propio; heredan la categoría del gasto
  (elegirla en el gasto antes de pagar, o cambiarla luego en Bancos).

## Módulo: Bancos — Reglas por tipo de cuenta (2026-09-27)

Solo hay tres tipos: Cuenta de ahorro, Cuenta corriente y Tarjeta de
crédito (no se maneja Caja/Efectivo). La validación la hace la base de
datos (trigger de la migración 063), así que aplica a cualquier pantalla:
transferencias, pagos a proveedor, gastos pagados al crearlos y
movimientos manuales. Las entradas de dinero nunca se bloquean.

- **Ahorro**: nunca queda en negativo. Salida mayor al saldo → se bloquea:
  "Fondos insuficientes. La cuenta de ahorro «X» tiene un saldo disponible
  de RD$10,000.00 y la operación requiere RD$15,000.00. Las cuentas de
  ahorro no permiten sobregiros." No se registra nada.
- **Corriente sin sobregiro** (por defecto): igual que ahorro.
- **Corriente con sobregiro autorizado** (Editar cuenta → Permitir
  sobregiro): aviso "Fondos insuficientes… generará un sobregiro de
  RD$5,000.00. ¿Desea continuar?" con Cancelar / Continuar. Solo con
  Continuar se registra; la cuenta queda en negativo ("En sobregiro") y la
  confirmación queda guardada en el movimiento.
- Cuentas viejas sin tipo: se tratan como corriente sin sobregiro hasta que
  se les asigne el tipo.
- En una transferencia, si la salida no pasa la validación no se registra
  ninguna de las dos partes.

### Tarjetas de crédito
- Se muestran Deuda, Saldo a favor y Disponible. Nunca "deuda negativa".
- Pago mayor que la deuda: la deuda llega a 0 y el excedente queda como
  saldo a favor. El formulario avisa antes: "La tarjeta no tiene
  suficiente deuda para aplicar el pago completo. El excedente de RD$X se
  registrará como saldo a favor."
- Pago a tarjeta sin deuda (pago anticipado): permitido, todo es saldo a
  favor. Ej.: pasar US$1,000 a la tarjeta en dólares → Saldo a favor
  US$1,000.
- Compras: consumen primero el saldo a favor; el excedente es deuda.
- Disponible = límite − deuda. Si el banco permite que el saldo a favor
  aumente el poder de compra, marcar en la tarjeta "El saldo a favor
  aumenta el crédito disponible por encima del límite": disponible =
  límite − deuda + saldo a favor. Por defecto apagado.
- Compra mayor al disponible → "Crédito insuficiente…". Sin límite
  configurado no se valida.

## Módulo: Proveedores — Categoría y Tipo de servicio (2026-09-27)

- Categoría del proveedor: de la lista de Configuración → Categorías.
- Tipo de servicio: catálogo en Configuración → Tipos de servicio; cada
  tipo pertenece a una categoría (Audiovisuales → Alquiler de sonido). En
  el formulario del proveedor solo aparecen los tipos de la categoría
  elegida.
- Si no existe: agregarlo en Configuración → Tipos de servicio (uno por
  uno o CSV con columnas categoria, tipo_servicio; si la categoría no
  existe, se crea).
- Los textos que ya tenían los proveedores se enlazaron con el catálogo
  (se crearon "Audio visuales", "Renta de Sonido", etc.).
- Nuevo gasto: al elegir el proveedor, la categoría se llena sola con la
  del proveedor (se puede cambiar). El pago en Bancos hereda esa categoría.
- Importación de proveedores por CSV: category / service_type se enlazan o
  se crean en los catálogos.

### Catálogo inicial para eventos (migración 065)
15 categorías de proveedores con 67 tipos de servicio listos para usar:
Audiovisuales (alquiler de sonido, pantallas LED, microfonía, DJ,
streaming…), Iluminación, Escenografía y montaje (tarimas, truss,
carpas…), Mobiliario y menaje, Decoración, Catering y alimentos (buffet,
bar, meseros…), Entretenimiento, Fotografía y video, Personal de eventos
(protocolo, seguridad, valet…), Transporte y combustible, Locales y
venues, Impresos y promocionales, Logística y servicios (plantas
eléctricas, baños portátiles, WiFi, permisos…) y Hospedaje y viajes. Se
editan o borran en Configuración. "Audio visuales" se unificó como
"Audiovisuales".

## General: pasos de avance en verde (2026-09-27)
En Facturas, Cotizaciones, Proyectos y Clientes, cada paso completado se
pinta en verde con ✓ (recuadro y círculo), el paso en curso en azul y los
pendientes en gris. El último paso (Pagada, Proyecto, Completado, Cliente)
queda en verde al alcanzarlo. Factura vencida: el paso en curso en rojo.

## Reportes: filtros de Ingresos y egresos por categoría (2026-09-27)
Además de fechas, cuenta y proyecto: Proyecto "Sin proyecto" (lo general de
la empresa), Tipo (solo ingresos / solo egresos), Origen (cobros de
clientes, pagos a proveedores, gastos sin proveedor, movimientos manuales,
transferencias), Cliente, Proveedor y Categoría (incluye "Sin categoría").
Elegir Origen "Transferencias" las incluye aunque la casilla esté apagada.

## Gastos: nuevo gasto desde un proyecto o proveedor (2026-09-27)
El botón "Nuevo gasto" dentro de un proyecto abre el formulario con el
proyecto elegido; al guardar o cancelar se vuelve al proyecto (pestaña
Gastos y proveedores). Desde un proveedor: proveedor elegido, categoría
sugerida y regreso al proveedor.

## General: montos en tarjetas de resumen (2026-09-27)
Los montos nunca se parten en dos líneas (antes el signo "-" quedaba
arriba). Si la tarjeta es angosta, el ícono pasa arriba y la letra se
ajusta al ancho.

## General: aviso de filtros sin resultados (2026-09-27)
Cuando un filtro no encuentra nada se muestra un aviso amarillo "No se
encontraron … con los filtros aplicados" con el botón "Limpiar filtros".
Aplica a Clientes, Proveedores, Cotizaciones, Proyectos, Facturas, Gastos,
Productos y servicios, Tareas, Bancos (lista y detalle de cuenta),
Auditoría y Reportes.

## General: volver al proyecto (2026-09-27)
Desde un proyecto, los enlaces a facturas, cotizaciones, gastos,
proveedores y al cliente, y los botones Nueva factura / Nuevo gasto,
llevan "← Volver al proyecto" (regresa a la pestaña donde estabas). La
factura creada desde el proyecto viene con el proyecto elegido y al
crearla conserva el "volver". Las pestañas de cliente/proveedor también
lo conservan.

## Bancos: detalle del movimiento más compacto (2026-09-27)
La columna Movimiento tiene ancho fijo: las descripciones largas bajan a
una segunda línea (máximo 2; el texto completo al pasar el mouse) en vez
de alargar la tabla hacia la derecha.

### Filtros después de un "sin resultados" (2026-09-27)
Con el aviso de "No se encontraron…" en pantalla, elegir otra opción en
cualquier filtro busca solo por esa opción (no arrastra los filtros que
dejaron la lista vacía); no hace falta pulsar Limpiar. Con resultados, los
filtros se siguen combinando. En el detalle de cuenta de Bancos, los
conteos de los botones consideran los demás filtros activos. En Reportes y
Auditoría (que tienen botón Aplicar/Filtrar) se cambian los campos y se
pulsa el botón.

## Bancos y Dashboard: dinero disponible (2026-09-28)
- Bancos (arriba): "Disponible en pesos" y "Disponible en dólares" = suma de
  las cuentas de ahorro y corrientes ACTIVAS de cada moneda. Dos totales
  separados: los dólares no se convierten ni se suman a los pesos.
  Desglose debajo: Ahorros · Corriente · (Sin tipo) · N cuentas.
- Tarjetas de crédito no cuentan como disponible (tienen "Deuda en
  tarjetas" y "Crédito disponible"). Una corriente en sobregiro resta.
- Dashboard: widgets nuevos "Disponible en bancos (pesos)" y "(dólares)",
  visibles al inicio para todos (se pueden ocultar en Personalizar).
- Filtro de tipo en Bancos: Todas / Ahorros / Corriente / Tarjetas de
  crédito (con conteos según la moneda elegida). Vista Tarjetas (hasta 4
  por fila, más compactas) o Lista (tabla, una fila por cuenta) para cuando
  haya muchas cuentas.

## Dashboard compacto con indicadores (2026-09-28)
- Dos zonas: franja de indicadores compactos arriba (hasta 5 por fila, con
  anillo de % o ícono y una línea de detalle) y paneles de gráficos/listas
  debajo en 3 columnas. Cada zona sigue el orden de Personalizar.
- Anillos: Ventas = cobrado este mes / facturado este mes; Gastos = gastos /
  ventas; Margen = utilidad / ventas; Por cobrar y Total vencido = vencido /
  por cobrar. Solo se usan datos que ya calculaba el Dashboard.
- Flujo financiero en área (cobros verde, pagos rojo) con totales de 6
  meses, neto y variación de cobros vs. mes anterior.
- Nuevo panel "Por cobrar según vencimiento" (barras: vencido, hoy, 7, 8–15
  y 16–30 días), visible por defecto al lado del gráfico.
- Tamaño en Personalizar: solo aplica a gráficos y listas (Grande = 2 de 3
  columnas). Mover cuadros sigue siendo desde Personalizar (se probó
  arrastrar en el propio Dashboard y se descartó).

## Ventanas al mover dinero y saldo disponible al pagar (2026-09-28)
- Fondos o crédito insuficiente (y "monto mayor a lo pendiente" en el pago
  de un gasto): ventana roja con el detalle y Cerrar, en lugar del texto
  rojo debajo del formulario. No se registra nada.
- Sobregiro autorizado: ventana amarilla Cancelar / Continuar (misma regla).
- Transferencia realizada y pago a proveedor registrado: ventana verde con
  monto y cuentas. Movimiento manual: aviso corto. El formulario queda en
  blanco después de cada operación (antes se quedaba el monto).
- Registrar pago de un gasto y Nuevo gasto: al elegir la cuenta aparece lo
  disponible (tarjeta: crédito disponible y deuda). En Registrar pago avisa
  si el monto no alcanza o si dejaría la cuenta en sobregiro. Solo
  informativo; la validación sigue en la base de datos.

## Categorías y tipos de servicio sin repetidos; guardar proveedor (2026-09-29)
- No hay lista aparte de "categorías de eventos": proveedores, gastos y
  Bancos usan la misma lista de Configuración → Categorías.
- Categorías: nombre único por empresa. Tipos de servicio: nombre único en
  toda la empresa (un tipo vive en una sola categoría). "Decoracion" =
  "Decoración" = " decoración " (mayúsculas, acentos y espacios no cuentan).
  Se valida en la pantalla, en la importación y en la base de datos
  (migración 066, índices únicos con `catalog_key(name)`).
- Importar tipos de servicio: columna opcional `descripcion_categoria` (para
  categorías nuevas); fila con tipo vacío = solo crea la categoría.
- Proveedor → Guardar cambios: aviso verde + "Guardado"; las listas de
  categoría/tipo ya no vuelven a la primera opción después de guardar.
- Crear categoría o tipo de servicio: aviso verde de confirmación.

## Catálogo completo cargado (2026-09-29)
- 81 categorías (eventos + administrativas y de dinero: TSS, capacitación,
  software, caja chica, aportes de capital, saldo inicial, ajustes
  bancarios, etc.) y 176 tipos de servicio, según el archivo del usuario.
- "Fotografia" se unió a "Fotografía y video"; "Incendio" (prueba) se borró
  y sus proveedores pasaron a Salud y emergencias / Prevención de incendios.

## Categorías y Tipos de servicio: páginas y buscador (2026-09-29)
- Ambas listas de 25 en 25 (Anterior/Siguiente), con buscador y contador.
  Tipos de servicio además filtra por categoría.

## Buscador en vivo (2026-09-29)
- Todos los buscadores (Clientes, Proveedores, Productos y servicios,
  Categorías y Tipos de servicio) filtran mientras escribes (sin Enter).
  Componente `LiveSearchInput`: usarlo en cualquier buscador nuevo.

## Entregas y acuses de recibo (2026-09-30)
- Comercial → Entregas y acuses (y cliente → pestaña Entregas). Registra lo
  entregado a un cliente (documentos, equipos, materiales, otros) y genera el
  acuse con el formato de Mindfreak (ACU-0001) para imprimir y firmar a mano.
- Flujo: Borrador → Pendiente de firma → Firmado (al adjuntar el acuse
  firmado, PDF o foto). Anulado conserva el historial. Editar mientras no
  esté firmado; Duplicar; Descartar borrador.
- Textos del modelo automáticos (párrafo de entrada, nota del pie según
  ejemplares); se pueden cambiar por acuse. Mínimo 8 filas en la tabla del
  PDF, total entregado = suma de cantidades.
- Permisos: deliveries.view (todos), deliveries.create (Admin, Gerente,
  Ventas, Operaciones), deliveries.cancel (Admin, Gerente).

## Encuesta de satisfacción del cliente (2026-09-30)
- Al hacer clic en Completado en el avance del proyecto se abre "Finalizar
  proyecto" con "¿Deseas enviar la encuesta de satisfacción al cliente?"
  (activada por defecto; se desmarca sola si ya hay una enviada/respondida).
- Destinatario: contacto del proyecto → contacto principal del cliente con
  correo → correo del cliente. Sin correo: queda Pendiente y se copia el
  enlace.
- Enviar por: Correo, WhatsApp o ambos (el correo no es obligatorio).
  WhatsApp abre el chat del cliente con el mensaje y el enlace (wa.me); al
  abrirlo la encuesta queda Enviada. Se puede reenviar por cualquier canal
  en cualquier orden, con el mismo enlace.
- Destinatario editable (nombre y correo) en Finalizar proyecto, Enviar
  encuesta y Reenviar (reenviar a otro correo usa el mismo enlace).
- Enlace público /encuesta/{token}: sin sesión, una sola respuesta, no
  expone IDs. Las preguntas se copian al crear la encuesta.
- Pestaña "Satisfacción del cliente" en el proyecto: estado, fechas,
  calificación general (promedio 1–5), NPS, recomendación, testimonio,
  comentarios y respuestas; Reenviar, Copiar enlace, Cancelar, Reabrir,
  Enviar otra.
- Configuración → Encuesta de satisfacción: preguntas (CRUD, orden,
  obligatoria, activa, indicador) y textos con {cliente} {proyecto}
  {empresa} {contacto}. Demora y recordatorios automáticos: guardados para
  una fase siguiente; hoy se envía al finalizar.
- Datos listos para reportes: project_surveys (overall_rating, nps_score,
  recommendation, testimonial_consent, responded_at) y
  project_survey_answers por pregunta.
- Permisos: surveys.view (todos), surveys.send (Admin, Gerente, Ventas,
  Operaciones), surveys.manage (Admin, Gerente).

## Dominio de producción y enlaces (2026-09-30)
- Dominio: https://business.mindfreakevents.com. Los enlaces que se envían
  (encuesta, invitaciones, recuperar contraseña) se arman con la variable
  APP_URL (lib/utils/app-url.ts); sin ella usan la dirección actual.
- Al desplegar: APP_URL en Cloudflare (Variables and Secrets), dominio
  propio en el Worker, Site URL + Redirect URLs en Supabase, hostname en
  Turnstile, SMTP_FROM del dominio. Detalle en README → "Dominio de
  producción y APP_URL" y en claude/checklist-produccion.md.

## Facturas vencidas (2026-10-01)
- "Vencida" no es un estado guardado: se calcula (Emitida o Pago parcial,
  con balance y fecha de vencimiento pasada). Se ve en la lista y su
  filtro, el detalle, la ficha del cliente y el reporte de Cuentas por
  cobrar. Regla única en features/invoices/overdue.ts.
