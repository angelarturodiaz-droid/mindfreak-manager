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

<!-- Agregar aquí nuevas notas a medida que surjan, con su propio ## encabezado de módulo -->
