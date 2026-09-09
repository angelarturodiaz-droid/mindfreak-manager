# CHANGELOG — Mindfreak Manager

## Ampliación: Servicios → Productos y Servicios

- El catálogo (tabla `services`, sin renombrar — sigue siendo la misma
  referenciada por `quotation_items`/`project_items`/`invoice_items`) ahora
  soporta bienes físicos además de servicios, ya que Mindfreak Events
  también vende productos (extintores, libretas, etc.), no solo servicios.
- Columnas nuevas (aditivas, migración `028_products_and_services.sql`):
  `type` (`PRODUCTO`/`SERVICIO`, default `SERVICIO` — no rompe datos
  existentes), `description`, `default_tax_percent`.
- UI renombrada a "Productos y Servicios" (menú lateral, título de página,
  breadcrumbs) — solo etiqueta visible, la ruta interna sigue siendo
  `/services`.
- Al elegir un producto/servicio del catálogo en una línea de cotización o
  factura, el % de impuesto ahora se autocompleta desde
  `default_tax_percent` (igual que ya pasaba con precio/costo). En facturas
  además se agregó el mismo auto-relleno de precio que ya tenía cotizaciones
  (antes solo se autocompletaba al copiar de un proyecto).
- Explícitamente NO incluye control de inventario/existencias — eso sigue
  clasificado como V3 en la arquitectura original.

## F14 — Bancos

- CRUD de cuentas bancarias (`bank_accounts`, ya existía desde F3/F4).
  Balance calculado (no almacenado) vía vista `bank_account_balances`
  (`security_invoker` — respeta el RLS del usuario que consulta, no del
  dueño de la vista): `opening_balance` + movimientos, sumando INCOME,
  restando EXPENSE y sumando TRANSFER con signo.
- Los movimientos por cobros/pagos a proveedores ya se generaban
  automáticamente desde F11/F13 (`register_customer_payment`/
  `register_supplier_payment`) — sin cambios ahí.
- Nuevo: **movimiento manual** (ingreso/gasto no ligado a una factura/gasto,
  ej. intereses, comisiones bancarias) y **transferencia entre dos cuentas
  propias**, esta última vía función transaccional `create_bank_transfer`
  (inserta dos filas — origen negativo, destino positivo — atómicamente,
  mismo patrón que F11/F13).
- Marcar movimientos como conciliados (`reconciled`, gated por
  `banks.reconcile`) — conciliación bancaria completa (import CSV/XLSX/OFX)
  sigue siendo V2 según F0-Arquitectura sección R.
- Verificado extremo a extremo con cuentas de prueba reales: transferencia
  de 200 entre dos cuentas, balances resultantes correctos (800/700).
  Advisors de seguridad revisados (mismo patrón ya aceptado de F11/F13 para
  funciones `SECURITY DEFINER` callables por `authenticated`). Datos de
  prueba limpiados después.

## F13 — Pagos a proveedores

- Función Postgres transaccional `register_supplier_payment` (mismo patrón
  que `register_customer_payment` de F11): crea el pago, actualiza
  `paid_amount`/`balance`/`status` del gasto (PENDING → PARTIALLY_PAID/PAID),
  genera movimiento bancario si se asoció una cuenta, y registra auditoría —
  todo en una sola transacción (rollback automático si algo falla).
- UI en el detalle del gasto: formulario "Registrar pago" (visible mientras
  el gasto esté PENDING/PARTIALLY_PAID) + historial de pagos. Si el gasto no
  tiene proveedor asignado, se muestra un aviso en vez del formulario (la
  tabla `supplier_payments` exige `supplier_id`, a diferencia de `expenses`
  donde es opcional).
- `/payments` ahora muestra dos secciones: Cobros (ya existía) y Pagos a
  proveedores (nuevo).
- Verificado extremo a extremo con datos de prueba reales: pago parcial
  correcto (PARTIALLY_PAID, balance recalculado), pago que excede el balance
  correctamente rechazado por la función. Datos de prueba limpiados después.

## F12 — Gastos

- Módulo completo sobre las tablas `expenses`/`expense_categories` (ya
  existían desde F3, con RLS desde F4 — sin cambios de esquema en esta fase).
  `features/expenses/*` + páginas `/expenses`, `/expenses/new`, `/expenses/[id]`.
- Un gasto puede ser de un proyecto/evento específico o general de la
  empresa (`project_id` opcional), con categoría y proveedor opcionales.
- Sin descuento (a diferencia de cotizaciones/facturas) — no aplica al
  registrar gastos. Impuesto igual que en cotizaciones/facturas: se escribe
  el % (default 18) y el servidor calcula el monto sobre el subtotal.
- Editable mientras `status='PENDING'` y `paid_amount=0` (sin pagos
  registrados); una vez tiene actividad real, solo se puede "Cancelar"
  (soft-state) — **nunca se borra físicamente un gasto**, a diferencia de
  cotizaciones/facturas en borrador: es una regla explícita de
  F0-Arquitectura, sección M ("nunca en... expenses"), así que no se agregó
  un "Descartar borrador" aquí como sí existe en cotizaciones/facturas.
- El registro de pagos a proveedores contra un gasto (que lo movería a
  `PARTIALLY_PAID`/`PAID`) queda para **F13 — Pagos a proveedores**.
- Verificado RLS con inserción real simulando el usuario admin vía SQL
  (`set role authenticated` + `request.jwt.claims`).

## Fix: "Descartar borrador" no borraba nada (RLS)

- **Bug real detectado por el usuario**: al descartar una cotización/factura
  en borrador, el mensaje de confirmación aparecía y no daba error, pero el
  registro seguía apareciendo en la lista — no se borraba.
- **Causa**: `quotations` e `invoices` tienen RLS habilitado con políticas de
  `select`/`insert`/`update`, pero **nunca se agregó una política de
  `delete`** — Postgres deniega por defecto sin policy, así que el
  `.delete()` se ejecutaba "exitosamente" pero afectaba 0 filas (no genera
  error, solo no borra nada).
- **Corrección** (migración `025_delete_draft_documents.sql`): se agregan
  políticas de `delete` para ambas tablas, restringidas a `status='DRAFT'`
  (RLS como segunda línea de defensa real, igual que ya valida la Server
  Action — F0-Arquitectura, sección L). Verificado con una simulación real
  del rol `authenticated` vía SQL: el delete ahora sí afecta la fila.
- Además, `discardQuotationAction`/`discardInvoiceAction` ahora verifican
  que el delete haya afectado al menos una fila (`.select('id')` sobre el
  delete) y lanzan un error explícito si no — para que un problema similar
  en el futuro se note de inmediato en vez de fallar en silencio.

## Ajustes rápidos: impuesto como % y descartar borradores

- **Impuesto vuelve a ser manual, pero ahora como porcentaje**: en vez de
  escribir el monto de impuesto en dólares/pesos, se escribe el % (por
  defecto 18, ej. ITBIS). El servidor calcula
  `impuesto = (cantidad×precio − descuento) × %` antes de sumar el total —
  ya no hay que calcularlo a mano. Esto reemplaza el selector de tasas
  parametrizadas (`tax_rates`) que se había agregado y luego revertido; la
  tabla y `/settings/tax-rates` quedan listas para cuando se construya el
  módulo de Configuración completo.
- **"Descartar borrador"** en cotizaciones y facturas: nuevo botón, visible
  solo mientras el documento está en `DRAFT`, que **elimina el registro por
  completo** (no solo cambia su estado como "Cancelar"). Pensado para
  cuando se crea una cotización/factura por error o se cambia de opinión
  justo después, antes de que tenga actividad real (envío, emisión, cobros).
  Una factura/cotización con actividad real sigue usando "Cancelar" (estado,
  preserva el registro para auditoría — F0 sección M).

## Ronda de correcciones post-F10/F11 (impuestos, PDF y duplicar)

Detectado durante pruebas reales del usuario en local, tras completar F10-F11.

- **Tabla `tax_rates`** (migración `024_tax_rates.sql`): tasas de impuesto
  nombradas por compañía (%), con una marcada como predeterminada. Sembrada
  con **ITBIS 18%** (predeterminada) y **Exento 0%** para Mindfreak Events.
  RLS: lectura amplia dentro de la compañía, escritura bajo `settings.manage`
  (mismo patrón que `services`/`service_categories`). Se agregó `tax_rate_id`
  (nullable) a `quotation_items` e `invoice_items` como referencia de
  auditoría — el monto de impuesto sigue congelándose en la línea, igual que
  el resto de campos financieros del sistema.
  - Explícitamente NO es la activación fiscal completa de NCF/ITBIS (DGII,
    reportes) — eso sigue siendo V2 según F0-Arquitectura, sección R. Es solo
    una parametrización ligera para que el impuesto se calcule como % en vez
    de escribirse a mano.
  - Página `/settings/tax-rates`: listar, crear, marcar predeterminada,
    activar/desactivar. Enlazada en el nav como "Impuestos" (mientras no
    exista el módulo de Configuración completo, que sigue en backlog).
  - Los formularios de línea de cotización/factura ahora tienen un selector
    de tasa (con la predeterminada preseleccionada) en vez de un campo
    numérico manual; opción "Manual" conserva el comportamiento anterior.
- **PDF + link de factura** (gap real: se construyó para cotizaciones en F8
  pero nunca se extendió a facturas en F10): `lib/pdf/invoice-document.tsx` +
  `generateInvoiceShareLinkAction`, mismo patrón que cotizaciones (URL
  firmada de Storage, 7 días de vigencia, registro en `documents`).
- **Botón "Descargar PDF"** agregado junto al link para compartir, tanto en
  cotizaciones como en facturas — antes solo se podía copiar el link.
- **Duplicar cotización / Duplicar factura**: crea un nuevo documento en
  BORRADOR con el mismo cliente/contacto (o cliente/proyecto en facturas) y
  todas las líneas copiadas (incluyendo la tasa de impuesto usada). El
  documento original nunca se modifica — decisión explícita para no romper
  la integridad de un documento ya emitido/aprobado (F0, sección M), evitando
  además tener que reescribir todo a mano cuando el cliente pide ajustar
  cantidades sobre algo ya facturado/cotizado.

## F11 — Cobros

- **Función Postgres transaccional `register_customer_payment`**
  (`SECURITY DEFINER`), tal como exige F0 sección H para operaciones
  financieras multi-tabla: en una sola transacción (1) crea el cobro, (2)
  actualiza `paid_amount`/`balance`/`status` de la factura (→
  `PARTIALLY_PAID` o `PAID`), (3) genera el movimiento bancario si se asoció
  una cuenta, (4) registra auditoría. Si cualquier paso falla, todo se
  revierte automáticamente (rollback de Postgres, no lógica manual en JS).
- Validaciones dentro de la función: rechaza cobrar una factura en estado no
  facturable, rechaza montos ≤ 0, y **rechaza sobre-pagos** (monto mayor al
  balance pendiente).
- **Probado exhaustivamente con datos reales antes de tocar el frontend**:
  pago parcial (verifiqué `PARTIALLY_PAID`), intento de sobre-pago (rechazado
  correctamente), pago final con cuenta bancaria (verifiqué `PAID`, el
  movimiento bancario y los 2 registros de auditoría) — luego limpié todos los
  datos de prueba.
- Server Action (`registerPaymentAction`) es solo un wrapper delgado sobre la
  función RPC — no reimplementa los pasos en JS, para no arriesgar la
  atomicidad.
- UI: formulario de cobro embebido en el detalle de la factura (solo visible
  si el estado y el balance lo permiten, y el usuario tiene `payments.create`),
  historial de cobros por factura, y página global `/payments` de solo
  lectura.
- Nota: no hay cuentas bancarias reales todavía (Bancos es F14) — el selector
  de cuenta muestra "Sin cuenta" como única opción hasta entonces; el cobro
  funciona igual, solo no genera movimiento bancario.
- Detectada (no bloqueante) una recomendación de seguridad de Supabase Auth
  ajena a este módulo — ver PROJECT_MASTER.md.

## F10 — Facturación

- **Módulo de Facturación**: crear factura ligada a un cliente directo o a un
  proyecto (si se elige proyecto, cliente y cotización de origen se derivan
  automáticamente — no hace falta elegirlos de nuevo). Líneas agregadas una
  por una (a diferencia de la conversión cotización→proyecto), permitiendo
  **facturación parcial/por cuotas** — común en eventos (depósito + factura
  final) — con opción de copiar valores desde una línea del proyecto como
  punto de partida editable.
- Campos NCF/`ncf_type` presentes y editables (sección R de F0: preparados,
  no activos/validados en producción todavía).
- **Flujo de estados en F10**: DRAFT → ISSUED (exige al menos una línea con
  total > 0) → CANCELLED. `PARTIALLY_PAID`/`PAID`/`OVERDUE` quedan para
  **F11 (Cobros)**, que los actualizará automáticamente al registrar pagos —
  no son botones manuales, para no romper la consistencia `paid_amount`/`balance`.
- `balance` se recalcula junto con los totales cada vez que cambian las líneas
  (`total - paid_amount`), dejando la estructura lista para que F11 solo tenga
  que sumar `paid_amount` sin duplicar lógica de cálculo.
- Verifiqué que no hay ambigüedad de relaciones PostgREST entre `invoices` y
  `projects` (a diferencia del caso resuelto en F9) — solo hay una FK en un
  sentido, el embed `projects(number, name)` no necesita desambiguarse.
- Agregado "Facturas" a la navegación del dashboard.
- Probado: build + lint limpios.

## F9 — Proyectos/Eventos

- **Módulo de Proyectos/Eventos**, con dos caminos de creación:
  1. **Conversión de cotización aprobada** (`convertQuotationToProjectAction`):
     copia cliente/contacto y todas las `quotation_items` → `project_items`
     sin reintroducir datos, vincula `quotation.project_id` ↔
     `project.quotation_id`, bloquea convertir una cotización no aprobada o
     ya convertida.
  2. **Proyecto directo**, sin cotización previa (la arquitectura ya lo
     permitía — `quotation_id` nullable).
- Detalle del proyecto con **pestañas** (sección 12 del prompt maestro):
  "Resumen" tiene contenido real (datos generales, líneas, presupuesto vs.
  costo estimado consumido); el resto (Finanzas, Ingresos, Gastos,
  Proveedores, Facturas, Cobros, Pagos, Bancos, Tareas, Documentos,
  Actividades, Rentabilidad) son placeholders que indican en qué fase futura
  se construyen — así no se finge funcionalidad que no existe.
- Flujo de estados de proyecto (PLANNING/CONFIRMED/IN_PROGRESS/COMPLETED/
  CANCELLED) con un solo permiso `projects.update` (sin aprobación especial,
  a diferencia de cotizaciones).
- Agregado el link "Convertir a Proyecto →" en el detalle de una cotización
  APPROVED (pieza pendiente de F8).
- Agregado "Proyectos" a la navegación del dashboard.
- Probado: build + lint limpios. La conversión cotización→proyecto (lógica
  multi-tabla más compleja hasta ahora) no se probó end-to-end en este
  entorno — recomendado que el usuario la pruebe en real antes de avanzar a
  F10 (Facturación depende de que existan proyectos y sus items).

## F8 — Cotizaciones

- **Módulo de Cotizaciones**: crear (cliente, fechas, moneda/tasa, condiciones),
  líneas de servicio (con cálculo automático de subtotal/descuento/impuesto/
  costo estimado por línea y agregado a nivel de cotización), listado con
  filtro por estado, detalle con totales y margen estimado.
- **Flujo de estados**: DRAFT → SENT (permiso `quotations.update`) →
  APPROVED/REJECTED (permiso `quotations.approve`, distinto del de edición) →
  CANCELLED. Botones de acción solo visibles si el usuario tiene el permiso
  correspondiente (capa de aplicación, además de RLS).
- **Generación de PDF + link de descarga** (decisión de F0, sección R): se
  adelantó de F17 la infraestructura mínima de Supabase Storage — bucket
  privado `documents` con políticas RLS basadas en `company_id` + permisos
  `documents.view`/`documents.upload`. El PDF se genera con
  `@react-pdf/renderer`, se sube a Storage, y se retorna una URL firmada
  (7 días de vigencia) para compartir por WhatsApp/correo.
- Se probó la generación de PDF en aislado (sin tocar Supabase) para validar
  que la librería funciona en este entorno antes de integrarla — generó un
  PDF válido correctamente.
- Nota de alcance: **"Convertir a Proyecto"** desde una cotización aprobada
  (sección O/13 del prompt maestro) se implementa en **F9 — Proyectos**, ya
  que requiere que exista el módulo de Proyectos.
- Agregado "Cotizaciones" a la navegación del dashboard.
- Probado: build + lint limpios.

## F7 — Servicios

- **Módulo de Servicios**: categorías (creación simple) + catálogo de servicios
  (nombre, categoría, unidad, precio/costo por defecto), edición y desactivar.
  Sin "lead" ni contactos — es un catálogo de configuración, no una entidad de
  relación con terceros.
- Escritura gateada por `settings.manage` (no por permisos propios de
  "services.*" — no existen en el catálogo, ver sección K del F0: es catálogo
  de configuración de empresa). Lectura abierta a cualquier usuario de la
  compañía, ya que cotizar/facturar necesita poder ver el catálogo.
- Agregado "Servicios" a la navegación del dashboard.
- Ajuste de tipos: el join embebido de PostgREST (`service_categories`) llega
  como arreglo aunque la relación sea muchos-a-uno; corregido el cast en la UI.
- Probado: build + lint limpios.

## F6 — Proveedores

- **Módulo completo de Proveedores**: listado con búsqueda, detalle/edición,
  contactos (crear/eliminar), desactivar (soft delete). Mismo patrón que
  Clientes (F5), pero sin el concepto de "lead" — un proveedor no tiene etapa
  potencial (sección 6 del prompt maestro).
- Server Actions con las 3 capas de seguridad y auditoría real en cada
  creación/edición/desactivación (`audit_logs`, reutilizando `lib/audit/log.ts`
  de F5 sin cambios).
- Agregado "Proveedores" a la navegación del dashboard.
- Probado: build + lint limpios.

## F5 — Clientes

- **Módulo completo de Clientes**: listado (con filtro por estado y búsqueda),
  detalle/edición, contactos (crear/eliminar), conversión LEAD→ACTIVE, desactivar
  (soft delete), e importación masiva vía CSV.
- `lib/audit/log.ts`: helper de auditoría reutilizable por todos los módulos
  futuros — cada creación/edición/conversión/desactivación de un cliente queda
  en `audit_logs`.
- Server Actions (`features/clients/actions.ts`) con las 3 capas de seguridad:
  UI condicional, `requirePermission()` al inicio de cada acción, y RLS como
  última línea (ya validada en F4).
- Validación con `zod` (`features/clients/schema.ts`), parseo de CSV con
  `papaparse`. Cada fila del CSV se valida individualmente; una fila inválida
  no aborta el resto — queda registrada en `import_batches.error_details` con
  su número de fila.
- Layout mínimo del dashboard con navegación lateral (se amplía por módulo a
  medida que se implementan F6 en adelante).
- Probado: build + lint limpios; parseo de CSV verificado con un archivo de
  ejemplo (fila sin nombre falla la validación como se esperaba, el resto se
  importa). Lógica de negocio (conversión idempotente, soft delete) revisada
  por código; prueba end-to-end en navegador pendiente de que el usuario corra
  `npm run dev` localmente (misma limitación de red del sandbox que en F4).

## F4 — Seguridad

- **Políticas RLS reales en las 32 tablas** (8 migraciones, `016` a `021`, más el
  helper `014`/`015`), reemplazando el denegar-todo de F3: cada tabla ahora valida
  `company_id` del usuario + el permiso correspondiente (`has_permission()`).
- Función auxiliar `user_company_ids()` para no repetir la subconsulta a
  `user_roles` en cada política.
- 2 permisos agregados (`documents.view`, `documents.upload`) que faltaban en el
  catálogo, asignados a los 5 roles.
- `lib/auth/permissions.ts`: capa de aplicación (2da de las 3 capas de seguridad) —
  `getCurrentUser()`, `hasPermission()`, `requirePermission()`, `getCurrentUserCompanyIds()`.
- Páginas de Auth: `/login` y `/recover-password` (Server Actions
  `signIn`/`signOut`/`requestPasswordReset`), sin registro público (Auth es interno).
- `proxy.ts` ahora protege rutas: sin sesión → `/login`; con sesión intentando
  entrar a `/login` o `/recover-password` → `/dashboard`.
- Stub protegido en `/dashboard` (contenido real en F16) para poder probar el flujo.
- **RLS probado con casos reales** (usuario de prueba temporal, creado y eliminado
  vía SQL): sin rol asignado no ve nada; con rol ADMIN puede crear/ver clientes;
  con rol FINANCE es bloqueado al crear un cliente pero sí ve facturas. Todos los
  casos se comportaron como se esperaba.
- Nota de transparencia: el sandbox de desarrollo no tiene salida de red hacia
  `*.supabase.co`, así que la prueba de RLS se hizo simulando el rol `authenticated`
  de Postgres vía SQL en lugar de un login real por navegador/Node — ver
  PROJECT_MASTER.md → Deuda técnica.

## F3 — Base de Datos

- **32 tablas** creadas en el proyecto Supabase real, en 13 migraciones versionadas
  (`supabase/migrations/001_*.sql` a `013_*.sql`), aplicadas y verificadas una por una:
  companies, profiles (+ trigger auto-creación desde `auth.users`), roles, permissions,
  role_permissions, user_roles (+ función `has_permission()`), clients (+ `status`
  LEAD/ACTIVE), client_contacts, suppliers, supplier_contacts, service_categories,
  services, bank_accounts (+ `opening_balance`), exchange_rates, quotations (+
  `currency`/`exchange_rate`), quotation_items, projects (+ `budget`), project_items,
  invoices, invoice_items, customer_payments, expense_categories, expenses,
  supplier_payments, bank_transactions, documents, tasks, activities, approvals,
  audit_logs, notifications, settings, import_batches.
- Resuelta la referencia circular `quotations` ↔ `projects` (FK diferida vía `ALTER TABLE`).
- Trigger genérico `set_updated_at()` aplicado a las 28 tablas con `updated_at`.
- **RLS habilitado en las 32 tablas** (denegar-todo por defecto); las políticas
  específicas se escriben en F4 — así no hubo ventana de tablas desprotegidas.
- **Seed aplicado**: compañía Mindfreak Events, 5 roles base (ADMIN, MANAGER, SALES,
  FINANCE, OPERATIONS), 30 permisos granulares, 92 asignaciones rol↔permiso.
  Guardado también en `supabase/seed/seed.sql` para resets locales.
- Revisados los *advisors* de seguridad y performance de Supabase: corregidos 2 WARN
  reales (search_path mutable en `set_updated_at`, RPC pública indebida de
  `handle_new_user`); el resto son INFO esperados (RLS sin políticas aún, índices sin
  uso en una BD nueva).
- Prueba de integridad real: FK bloquea `company_id` inexistente; insert válido
  confirma defaults correctos (`status = LEAD`, `currency = DOP`, `exchange_rate = 1`).

## F2 — Supabase

- Instaladas `@supabase/supabase-js` y `@supabase/ssr`.
- Creados `lib/supabase/client.ts` (Client Components) y `lib/supabase/server.ts`
  (Server Components/Actions), siguiendo el patrón oficial SSR de Supabase
  (sesión vía cookies, nunca localStorage — sección I de la arquitectura).
- Creado `lib/supabase/proxy.ts` + `proxy.ts` en la raíz (proxy/middleware de
  Next.js 16) para refrescar la sesión en cada request.
- Conectado al proyecto Supabase real `mindfreak-manager`
  (`hcospysvvwdfndihmemb.supabase.co`), obteniendo URL y clave pública
  (`publishable key`) directamente vía el conector de Supabase.
- `.env.local` (no versionado) con las credenciales reales; `.env.example`
  (sí versionado) como plantilla.
- Verificada la conexión real contra Supabase (`supabase.auth.getSession()`
  sin errores) y revisados los *advisors* de seguridad del proyecto (sin
  alertas — normal, aún no hay tablas).
- Build de producción verificado sin errores ni advertencias.

## F1 — Inicialización

- Proyecto Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 + ESLint inicializado.
- Estructura de carpetas completa según sección D de la arquitectura: `/app` (rutas
  auth y dashboard por módulo), `/components` (ui, layout), `/features` (un
  directorio por módulo de negocio), `/lib` (supabase, auth, audit, pdf), `/hooks`,
  `/types`, `/services`, `/utils`, `/supabase` (migrations, seed), `/tests` (unit,
  integration, e2e).
- Design Tokens de marca (Mindfreak Events) centralizados en `app/globals.css`
  vía `@theme inline` de Tailwind v4: `brand-primary`, `brand-accent`,
  `brand-secondary`, `brand-background`, `brand-surface`, `brand-text`,
  `brand-muted`, `brand-success`, `brand-warning`, `brand-danger`.
- Página de inicio y layout mínimos, sin lógica de negocio.
- Nota: se removió la fuente Geist de Google Fonts (el entorno de build no tenía
  acceso a fonts.googleapis.com); se usa la fuente del sistema vía Tailwind
  (`font-sans`). Se puede reintroducir una fuente personalizada más adelante
  auto-hospedada (`next/font/local`) si se desea, sin impacto arquitectónico.
- Build de producción verificado (`npm run build`) sin errores.

## F0 — Arquitectura

- Arquitectura general aprobada (ver `F0-Arquitectura-MindfreakManager.md`).
- Ajustes incorporados durante la revisión: multimoneda real, UX/UI como
  principio transversal, clientes potenciales (leads), saldo inicial de
  cuentas bancarias, importación masiva de clientes vía CSV, catálogo de
  reportes (F19), presupuesto de proyecto explícito en el flujo central,
  y backlog inicial (alerta de presupuesto).
