# Estado Actual del ERP — Mindfreak Manager

**Fecha**: 2026-09-18. Este documento resume qué es Mindfreak Manager hoy,
como referencia rápida antes de cualquier evolución futura hacia
contabilidad de partida doble.

## Qué SÍ maneja el sistema hoy

- **ERP financiero-operativo completo**: Clientes, Proveedores,
  Cotizaciones, Proyectos, Facturas (con Condiciones de pago, Comisión de
  la empresa, Facturación Tradicional y Electrónica preparada), Cobros,
  Gastos, Pagos, Bancos y Movimientos bancarios, Impuestos/ITBIS
  (catálogo configurable), Usuarios y Permisos por rol, Dashboard
  configurable, Alertas de vencimiento automáticas, Historial de gestión
  de cobro, Auditoría de cambios (`audit_logs`).
- **Contabilidad de caja (single-entry)**: cada movimiento de dinero
  queda registrado en `bank_transactions` con un solo monto y una sola
  cuenta — no hay débito/crédito emparejado.
- **Inmutabilidad financiera real**: `expenses`, `bank_transactions`,
  `customer_payments`, `supplier_payments` no se pueden borrar bajo
  ninguna circunstancia desde la aplicación (sin política de DELETE en la
  base de datos).
- **Multi-moneda con tasa congelada por documento** (`exchange_rate` en
  cada factura/gasto/pago).
- **Toda la lógica de movimiento de dinero centralizada** en 5 funciones
  de Postgres (`register_customer_payment`, `register_supplier_payment`,
  `create_bank_transfer`, `create_card_expense`,
  `generate_due_date_alerts`).

## Qué NO maneja el sistema hoy

- **Contabilidad de partida doble**: no existe plan de cuentas, asientos
  contables, libro diario, libro mayor, balance de comprobación, estados
  financieros, períodos contables ni cierres. Confirmado con búsqueda
  directa en las 48 migraciones — cero coincidencias de `chart_of_accounts`,
  `journal_entr*`, `general_ledger`, `debit`, `ledger`.
- **Activos, Pasivos, Patrimonio** como conceptos contables formales.

## Documentos relacionados

- `BACKUP-pre-contabilidad-v1.md` — snapshot del esquema y punto de
  recuperación (tag de Git `pre-contabilidad-v1`) previo a cualquier
  trabajo de contabilidad.
- Diagnóstico completo de evolución hacia partida doble — conversación
  del [fecha del análisis], con el diagnóstico punto por punto y la
  conclusión de escenario **B: parcialmente preparada, requiere algunos
  ajustes** (no A, no C, no D).
- `FASE-FACTURACION-ELECTRONICA-DGII.md` / `OPCION-FACTURACION-ELECTRONICA-BAJO-VOLUMEN.md`
  — mismo patrón de "documentar antes de construir" aplicado a e-CF.

## Corrección aplicada como parte de esta revisión

- `tax_rate_id` en `invoice_items`/`quotation_items` era un campo
  vestigial (nunca se poblaba al crear una línea, solo se copiaba al
  duplicar un documento — confirmado con datos reales: 0 de 8 líneas
  existentes lo tenían poblado). Corregido de forma aditiva: ahora se
  vincula automáticamente cuando el % de impuesto coincide con una tasa
  activa del catálogo — **sin cambiar en absoluto el cálculo del ITBIS**
  (`tax_percent` sigue siendo la única fuente de verdad del cálculo).
  Verificado con datos reales que el cambio no alteró ningún dato
  histórico ni ningún total financiero existente.
