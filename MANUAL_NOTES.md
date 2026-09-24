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
