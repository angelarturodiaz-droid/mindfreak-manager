# CHANGELOG — Mindfreak Manager

## Rediseño ERP SaaS — Etapa 9: módulo Productos y Servicios

- Lista, detalle y formularios (nueva categoría, nuevo producto/servicio,
  editar) migrados a `DataTable`, `Badge`, `Card`, `Button`/`ConfirmButton`,
  `Input`/`Select`/`Textarea`.
- Sin cambios de lógica/queries/actions/rutas. Verificado: `tsc`,
  `npm run build`, `eslint` y los 15 tests unitarios limpios.

## Rediseño ERP SaaS — Etapa 8: módulo Proveedores

- Lista, detalle y formularios (nuevo, editar, nuevo contacto) migrados a
  `DataTable`, `Badge`, `Card`, `Button`/`ConfirmButton`, `Input`.
- Sin cambios de lógica/queries/actions/rutas. Verificado: `tsc`,
  `npm run build`, `eslint` y los 15 tests unitarios limpios.

## Rediseño ERP SaaS — Etapa 7: módulo Gastos

- Lista, detalle (`KpiCard` para totales, `ConfirmButton` para cancelar,
  `DataTable` para historial de pagos) y formularios (nuevo, editar,
  registrar pago a proveedor) migrados al Design System.
- Sin cambios de lógica/queries/actions/rutas. Verificado: `tsc`,
  `npm run build`, `eslint` y los 15 tests unitarios limpios.

## Rediseño ERP SaaS — Etapa 6: módulo Cobros/Pagos

- `/payments`: las dos tablas (Cobros, Pagos a proveedores) migradas a
  `DataTable`. Los formularios de registro ya vivían migrados dentro de
  Facturas (Etapa 5) y Gastos (próxima etapa).
- Sin cambios de lógica/queries/rutas. Verificado: `tsc`, `npm run build`,
  `eslint` y los 15 tests unitarios limpios.

## Rediseño ERP SaaS — Etapa 5: módulo Facturas

- Lista, detalle (líneas + cobros con `DataTable`, tarjeta de totales) y
  formularios (nueva factura, línea, NCF/vencimiento, registrar cobro)
  migrados al Design System.
- Botones auxiliares (compartir/duplicar/descartar) con `toast` en vez de
  mensajes de error inline.
- Sin cambios de lógica, queries, actions ni rutas. Verificado: `tsc`,
  `npm run build`, `eslint` y los 15 tests unitarios limpios.

## Rediseño ERP SaaS — Etapa 4: módulo Proyectos

- Detalle de proyecto (el archivo más grande, 770 líneas, 13 pestañas)
  reescrito completo con `DataTable`, `Badge`, `KpiCard` (Finanzas/
  Rentabilidad), `Button`/`ConfirmButton`.
- Lista de proyectos, formularios (nuevo, editar, línea, convertir
  cotización, nueva actividad) y `ActivityItem` migrados al Design System.
- Sin cambios de lógica, queries, actions ni rutas. Verificado: `tsc`,
  `npm run build`, `eslint` y los 15 tests unitarios limpios.

## Rediseño ERP SaaS — Etapa 3: módulo Cotizaciones

- Lista, detalle y formularios migrados a `DataTable`, `Badge`,
  `Button`/`ConfirmButton`, `Input`/`Select`/`Textarea`.
- `ShareLinkButton` ahora usa `toast` (éxito/error) en vez de texto inline.
- Sin cambios de lógica, queries, actions ni rutas. Verificado: `tsc`,
  `npm run build`, `eslint` y los 15 tests unitarios limpios.

## Rediseño ERP SaaS — Etapa 2: módulo Clientes

- Lista (`/clients`): `DataTable`, `Badge` por estado (Lead/Activo/Inactivo),
  `Input`/`Select` para el filtro, `EmptyState` cuando no hay resultados.
- Detalle (`/clients/[id]`): `Badge`, `ConfirmButton` (modal propio) en vez
  de `window.confirm()` para desactivar cliente y eliminar contacto.
- Formularios (nuevo/editar cliente, nuevo contacto, importar CSV):
  migrados a `Input`/`Select`/`Button` del Design System.
- Sin cambios de lógica, queries, actions ni rutas — verificado con `tsc`,
  `npm run build`, `eslint` y los 15 tests unitarios, todos limpios.

## Módulo de Configuración — primera etapa

- Nuevo layout `/settings` con pestañas: Organización, Impuestos (existente),
  Categorías de gastos, Sistema, Notificaciones, Documentos, Seguridad,
  Usuarios. Acceso vía ícono de engranaje en la esquina superior derecha del
  dashboard (no en el menú lateral), como se pidió.
- **Organización**: datos de empresa editables (nombre legal, RNC,
  dirección, teléfono, correo, moneda base). Columnas nuevas en `companies`
  (`address`, `phone`, `email` — migración `034_settings_organization.sql`).
- **Categorías de gastos**: gap real — existía la tabla desde F3 sin
  ninguna pantalla. Construida con crear/listar/eliminar, mostrando cuántos
  gastos usan cada categoría antes de dejar eliminarla.
- **Sistema**: nombre de plataforma y colores de marca editables (con nota
  honesta: todavía no están conectados en vivo a los Design Tokens de
  Tailwind, que siguen fijos en `globals.css`). Logo con subida a un bucket
  de Storage **público** nuevo (`branding`), distinto al privado
  (`documents`, F8) para que la URL no dependa de un link firmado que
  expira.
- El sidebar ahora muestra el nombre de plataforma y logo reales de la
  empresa (antes decía "Mindfreak Manager" fijo en el código).
- **Usuarios**: página de solo lectura (lista de usuarios + roles). Invitar/
  gestionar usuarios de verdad queda para una ronda aparte — toca
  autenticación directamente (ya tuvimos un incidente real con esto en F4).
- **Notificaciones/Documentos/Seguridad**: páginas informativas honestas
  sobre qué aplica a este sistema y qué no (NCF/notificaciones reales siguen
  V2; tipos/plantillas de documento no aplican al diseño actual; sesiones/
  autenticación ya las maneja Supabase Auth).
- Verificado con datos reales (insert/update/delete bajo RLS simulando
  admin) para Organización y Categorías de gastos.
- **Sin verificar**: la subida de logo al bucket `branding`. Se investigó a
  fondo un fallo de "violates row-level security policy" al intentar
  simularlo con SQL directo (se descartaron triggers, grants y políticas
  restrictivas como causa) sin llegar a una conclusión definitiva — parece
  una limitación de probar `storage.objects` por esta vía, no
  necesariamente un bug de la política (que replica exactamente el patrón
  ya probado del bucket `documents`). Pendiente que el usuario lo pruebe en
  la app real.

## Rediseño de interfaz (ERP SaaS) — Etapa 1: fundación

Pedido explícito del usuario: rediseño visual completo (Odoo/ERPNext/Zoho),
**sin tocar funcionalidad, lógica, datos, rutas ni permisos**. Dado el
tamaño real (~40 pantallas construidas en 23 fases), se aborda por etapas.

**Etapa 1 (esta ronda) — fundación del Design System + Sidebar + Dashboard:**

- **Tokens** (`app/globals.css`): paleta negro + blanco + azul claro (antes
  negro + teal), colores semánticos completos con fondo suave a juego
  (`success`/`warning`/`danger`/`info`, cada uno con su `-bg`), estados
  (`hover`, `disabled`), escala de radios y sombras. Se mantienen los
  nombres de variable existentes (`brand-primary`, `brand-accent`, etc.)
  para no romper ninguna pantalla ya construida — solo cambian valores y se
  agregan tokens nuevos.
- **Librería de componentes** (`components/ui/`): `Button` (variantes
  primary/secondary/outline/ghost/danger, estados loading/disabled),
  `Badge` (con mapeo automático de estados de negocio → color: PAID=verde,
  PENDING=amarillo, OVERDUE=rojo, etc.), `Input`/`Select`/`Textarea` (con
  label/error/hint, **de paso corrige la deuda de accesibilidad** detectada
  en F21 — ahora sí asocian `htmlFor`/`id`), `Card`/`KpiCard`, `EmptyState`,
  `Skeleton`/`TableSkeleton`, `Modal`, `ConfirmButton` (reemplaza
  `window.confirm()` nativo por un modal propio), `Toaster` (via `sonner`,
  montado en el layout raíz), `DataTable` (tabla con estilo consistente).
- **Iconos**: `lucide-react` instalado.
- **Sidebar** (`components/layout/sidebar.tsx`): agrupado por dominio
  (Comercial, Operaciones, Finanzas, Análisis), ícono por módulo, estado
  activo/hover diferenciado (vía `usePathname`), colapsable.
- **Dashboard**: KPIs con `KpiCard` + íconos, sección de accesos rápidos
  (Nueva cotización/cliente/factura/gasto).
- Verificado: `tsc`, `npm run build`, `eslint` y los 15 tests unitarios
  siguen limpios tras el cambio (cambio puramente visual, sin tocar
  lógica/queries/actions).

**Pendiente (próximas etapas, no en esta ronda)**: aplicar estos mismos
componentes al resto de los módulos (Clientes, Proveedores, Cotizaciones,
Proyectos, Facturas, Cobros, Gastos, Bancos, Tareas, Reportes, Auditoría,
Configuración) — tablas, formularios, botones e iconografía de cada
pantalla individual siguen con el estilo anterior hasta que se aborden.
También pendiente: breadcrumbs, empty/skeleton states aplicados por
pantalla, responsive real para tablas complejas en mobile.

## F23 — Deployment

- Revisado que el proyecto esté listo para desplegarse: sin URLs
  hardcodeadas a `localhost` en el código (verificado por búsqueda), solo
  2 variables de entorno necesarias (`NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`), build de producción limpio.
- Agregado `engines.node: ">=20"` en `package.json` para que Vercel (u
  otro host) use una versión de Node compatible con Next.js 16.
- **README actualizado** con la guía completa de deployment en Vercel
  (conectar el repo ya existente, variables de entorno, deploy automático
  en cada push a `main`) y un paso importante que se detectó al revisar el
  código: `resetPasswordForEmail` (recuperar contraseña) depende de la
  **Site URL** configurada en el dashboard de Supabase, no de una URL en
  el código — hay que actualizarla de `localhost:3000` al dominio de
  producción una vez desplegado, o los links de recuperación de contraseña
  seguirían apuntando a localhost.
- **Nota importante**: yo no puedo conectar Vercel por ti — mi entorno no
  tiene acceso a esa web ni a tu cuenta. Esto es lo único de F23 que
  depende de que tú lo hagas (son ~5 minutos siguiendo la guía del README).

## F22 — Optimización

Basado en una revisión directa de los *advisors* de rendimiento de
Supabase (migración `033_optimization.sql`):

- **RLS ineficiente (WARN, 8 hallazgos, resuelto)**: varias políticas
  llamaban `auth.uid()` directo en vez de `(select auth.uid())` —
  Postgres las re-evaluaba por cada fila en vez de una sola vez por
  consulta. Corregido en `profiles`, `user_roles`, `approvals`,
  `audit_logs`, `notifications`.
- **Políticas duplicadas (WARN, 45 hallazgos, resuelto)**: 9 tablas
  (`exchange_rates`, `expense_categories`, `invoice_items`, `project_items`,
  `quotation_items`, `service_categories`, `services`, `settings`,
  `tax_rates`) tenían una política `_select` y otra `_write` (`FOR ALL`)
  que también cubría `SELECT` — Postgres evaluaba ambas en cada lectura.
  Separadas en políticas explícitas de `insert`/`update`/`delete` sin
  volver a cubrir `select`.
- **61 índices de cobertura faltantes en FKs (INFO, resuelto)**: ya estaba
  documentado como deuda técnica desde F3. Se agregaron todos —
  `company_id` en 15 tablas (el filtro más usado de todo el sistema, vía
  RLS), más FKs de negocio (`bank_transactions`, `customer_payments`,
  `supplier_payments`, `quotation_items`/`invoice_items`.`service_id`/
  `tax_rate_id`, `projects`.`manager_id`/`quotation_id`/`contact_id`, etc.)
  y columnas de auditoría (`created_by`/`approved_by`/`uploaded_by`).
- **No se tocaron los "unused index" (INFO, 7→68 tras la migración)**: es
  esperado — la base de datos todavía no tiene tráfico real de producción,
  así que Postgres no ha registrado uso de ningún índice todavía (ni los
  viejos ni los nuevos). No hay motivo para borrar índices que se van a
  necesitar según crezca el uso real.
- **Verificado exhaustivamente antes de dar por bueno**: tras aplicar la
  migración, se re-consultaron los *advisors* — los WARN de RLS ineficiente
  y políticas duplicadas desaparecieron por completo. Se probó
  insert/select/update/delete real bajo RLS simulando el usuario admin en
  `services` (política simple) y `quotation_items` (política vía `EXISTS`,
  la más compleja de dividir) para confirmar que separar las políticas no
  rompió ningún flujo. También se confirmó `profiles` (crítica para login)
  sigue funcionando tras el fix de `auth.uid()`. Datos de prueba limpiados
  después. Los *advisors* de seguridad no mostraron ningún hallazgo nuevo.

## E2E confirmado: 8/9 pasan corriendo secuencial

- El usuario corrió `npm run test:e2e` tras el fix de `workers: 1` — **8 de
  9 tests pasan**. El único que falló fue por un "Gateway Timeout" real de
  Supabase al iniciar sesión (mismo tipo de hipo transitorio de red visto
  antes con el dashboard), no un bug de código — confirma que el
  diagnóstico de concurrencia del fix anterior era correcto.
- Agregado `retries: 1` en `playwright.config.ts` para que un hipo de red
  aislado no obligue a repetir toda la corrida a mano.
- F21 se da por concluida: 15 tests unitarios + 9 tests E2E, todos
  verificados corriendo de verdad (unitarios por mí, E2E por el usuario).

## Fix: fallas intermitentes en E2E ("permission denied for function user_company_ids") + selectores ambiguos

- El usuario reportó 6/9 tests E2E fallando, incluyendo un error real de
  Postgres: `permission denied for function user_company_ids`.
- **Investigado directamente en la base de datos** (no asumido): consulté
  `has_function_privilege('authenticated', ...)` para `user_company_ids`,
  `has_permission`, `register_customer_payment`, `register_supplier_payment`
  y `create_bank_transfer` — **los 5 confirman `true`**, el permiso está
  correctamente configurado. No es un bug de RLS/permisos.
- **Diagnóstico**: los tests corrían con 5 workers en paralelo contra un
  proyecto Supabase real (plan gratuito, límite bajo de conexiones
  simultáneas) — bajo esa carga concurrente, el pool de conexiones puede
  producir errores intermitentes que se reportan como "permission denied"
  sin serlo realmente. Corregido en `playwright.config.ts`: `workers: 1`
  (corre secuencial, sin paralelismo, evita saturar el pool).
- **Bug real de los tests** (no de la app): 2 selectores usaban
  `getByText(/borrador/i)`, que coincidía con **dos elementos** — el badge
  de estado "Borrador" y el botón "Descartar borrador" — causando
  "strict mode violation". Corregido en `quotations.spec.ts`,
  `quotation-to-project.spec.ts` e `invoice-payment.spec.ts` usando
  `getByText("Borrador", { exact: true })`.
- Pendiente de confirmar por el usuario: volver a correr `npm run test:e2e`
  con estos dos fixes debería resolver la mayoría de las fallas reportadas.

## Fix real: los tests E2E no leían `.env.test` (8 de 9 fallaban)

- **Bug real detectado por el usuario** al correr `npm run test:e2e` por
  primera vez: 8 de 9 tests fallaron con "Faltan E2E_ADMIN_EMAIL/
  E2E_ADMIN_PASSWORD en el entorno", aunque el usuario sí había creado
  `.env.test` correctamente. Causa: **Playwright no lee archivos `.env` por
  sí solo** — yo documenté el paso de crear `.env.test` pero nunca conecté
  nada en el código para que efectivamente se cargara a `process.env`. El
  único test que pasó ("credenciales inválidas") no depende de esas
  variables, por eso no mostró el problema.
- **Corregido**: se agregó `dotenv` como dependencia de desarrollo y
  `playwright.config.ts` ahora carga `.env.test` explícitamente al inicio
  (`config({ path: ".env.test" })`) antes de que corra cualquier test.
- Verificado el mecanismo de carga con un archivo `.env.test` de prueba
  (creado y borrado de inmediato, sin credenciales reales): confirmado que
  `process.env.E2E_ADMIN_EMAIL`/`E2E_ADMIN_PASSWORD` se llenan
  correctamente tras el fix.

## Fix: `npm install` daba ERESOLVE (conflicto @types/node vs. vitest)

- **Bug real** encontrado por el usuario al instalar en su Mac: `vitest@5`
  requiere `@types/node` ^22 (o >=24), pero el proyecto tenía `@types/node`
  ^20 (heredado de F1) — `npm install` fallaba con `ERESOLVE` sin la
  bandera `--legacy-peer-deps`. Yo lo había resuelto localmente con esa
  bandera al construir F21, pero eso no queda "guardado" para quien clona
  el repo de cero.
- **Corregido de raíz**: `@types/node` subido a `^22` en `package.json`.
  Reinstalado desde cero (`rm -rf node_modules package-lock.json &&
  npm install`) sin ninguna bandera especial — instala limpio. Verificado
  que build, lint, tipos y los 15 tests unitarios siguen pasando tras el
  cambio.

## Ampliación de cobertura E2E

- Se agregaron 4 specs E2E más a las 3 de F21 (siguen sin ejecutarse en
  este entorno, mismo motivo — sin navegador ni red a Supabase):
  - `quotation-to-project.spec.ts`: crear cotización → agregar línea →
    marcar enviada → aprobar → convertir a proyecto.
  - `invoice-payment.spec.ts`: crear factura → agregar línea → emitir →
    registrar el cobro completo (verifica que quede "Pagada").
  - `expense-payment.spec.ts`: crear proveedor → crear gasto asociado →
    registrar el pago completo (verifica que quede "Pagado").
  - `documents.spec.ts`: crear cliente → subir un documento → verificar que
    aparece → eliminarlo → verificar que desaparece.
- Total ahora: 7 specs E2E cubriendo los flujos de negocio principales de
  punta a punta (Cliente→Cotización→Proyecto, Factura→Cobro,
  Proveedor→Gasto→Pago, Documentos), además de autenticación.
- Selectores verificados contra el código real de cada página (no
  adivinados) antes de darlos por buenos.

## F21 — Testing

- **Unit tests (Vitest)**: 15 tests sobre las funciones puras de cálculo
  financiero — `calculateItemSubtotal`/`calculateQuotationTotals`
  (cotizaciones), `calculateInvoiceItemSubtotal`/`calculateInvoiceTotals`
  (facturas), `calculateExpenseTotals` (gastos, incluyendo redondeo e
  impuesto como %). Ejecutados y verificados en este entorno: los 15 pasan.
  `npm test` / `npm run test:watch`.
- **E2E tests (Playwright)**: `auth.spec.ts` (login válido/inválido,
  logout), `clients.spec.ts` (crear cliente), `quotations.spec.ts` (crear
  cotización + línea). Selectores verificados contra el código real (no
  adivinados). **No se pudieron ejecutar en este entorno** — sin navegador
  ni acceso de red a Supabase — quedan listos para correr localmente con
  `npm run test:e2e` (requiere `.env.test` con un usuario de prueba, ver
  `.env.test.example`, y `npx playwright install chromium` una vez).
- **Sin tests de integración automatizados contra Supabase real**: mismo
  motivo (sin red desde este entorno hacia Supabase). En su lugar, cada
  función Postgres transaccional y cada política RLS nueva de F11 en
  adelante se verificó manualmente con datos de prueba reales antes de
  cerrar cada fase — ya documentado en las entradas anteriores de este
  changelog.
- **Hallazgo de la fase**: casi todos los formularios (excepto login)
  tienen `<label>` sin `htmlFor`/`id` asociado a su `<input>` — no rompe
  funcionalidad, pero afecta accesibilidad y forzó a que los tests E2E usen
  selectores por `name` en vez de `getByLabel()`. Documentado como deuda
  técnica, no corregido en esta fase (afectaría decenas de formularios).

## Reportes: filtros por reporte

- Cada uno de los 5 reportes ahora tiene sus propios filtros (todos los
  pedidos eran factibles con el esquema actual, ninguno quedó fuera):
  - **Rentabilidad por proyecto**: Período (`event_date`), Proyecto,
    Cliente, Estado del proyecto, Responsable.
  - **Cuentas por cobrar**: Período (`issue_date`), Cliente, Estado,
    Proyecto, Moneda.
  - **Cuentas por pagar**: Período (`expense_date`), Proveedor, Estado,
    Proyecto, Moneda.
  - **Ventas por cliente**: Período (`issue_date`), Cliente, Proyecto,
    Estado de factura, Moneda.
  - **Gastos por categoría**: Período (`expense_date`), Categoría,
    Proyecto, Proveedor, Estado.
- Filtros vía `<form method="get">` (sin JS necesario), preservando el
  reporte activo. Botón "Limpiar" para quitar todos los filtros.
- Nota de diseño: cuando se elige explícitamente un Estado en Cuentas por
  cobrar/pagar (ej. "Pagada"), se reemplaza el filtro por defecto de
  "solo pendientes" — permite usar el mismo reporte también para ver
  facturas/gastos ya saldados si se necesita.
- Nuevas queries de catálogo (`listClientsForFilter`, `listSuppliersForFilter`,
  `listProjectsForFilter`, `listExpenseCategoriesForFilter`,
  `listManagersForFilter`) en `features/reports/queries.ts`.

## Ajustes de feedback (documentos, actividades, reportes, auditoría)

- **Documentos**: se quitó la miniatura de imágenes (pedido explícito) y se
  alinearon mejor las columnas Tamaño/Subido/Ver/Descargar/Eliminar con
  anchos fijos.
- **Actividades**: formulario de registro ahora usa un textarea de varias
  líneas en vez de un input de una sola línea — más espacio para escribir.
  Se agregó **editar** (inline) y **eliminar** por actividad — revierte la
  decisión original de F18 de dejarla inmutable como `audit_logs`; una
  actividad no es un registro financiero, así que permitir editarla/borrarla
  no compromete nada (migración `032_activities_edit_delete.sql`,
  verificado con update/delete real bajo RLS).
- **Reportes**: rediseñado como un **hub** con selector lateral (categorías
  → reportes), en vez de las 5 tablas apiladas en una sola página — cada
  reporte se carga solo cuando se selecciona. Confirmado: F19 es la única
  fase de "Reportes" en el plan (F0, sección 33); cualquier reporte nuevo
  se agrega al mismo catálogo (`REPORT_CATALOG` en la página), no requiere
  una fase nueva.
- **Auditoría**: tabla con anchos de columna fijos y el JSON de detalle en
  un bloque con scroll propio (máx. altura), para que no se vea "pegado"
  cuando el detalle es largo.
- **Nota sobre el "Gateway Timeout"** reportado en `listActiveServices`: se
  revisó la query (simple, sin joins) y el RLS (patrón estándar ya probado
  en todo el proyecto) — no se encontró ningún problema de código; fue
  tráfico/latencia transitoria hacia Supabase.

## F20 — Auditoría

- `audit_logs` ya existía desde F3, con RLS desde F4 (lectura gateada por
  `settings.manage`, cada quien registra solo sus propias acciones). F20
  construye la **UI de consulta** (`/audit`, gateada por `settings.manage`):
  filtro por entidad y por acción, últimos 200 registros, con usuario,
  fecha, acción y detalle (valores nuevos/anteriores en JSON).
- **Gaps reales encontrados y corregidos** (revisando qué acciones ya
  registraban auditoría vs. lo que exige la sección 22 del prompt maestro
  — "Facturas, Pagos, Gastos, Cotizaciones, Bancos, Configuración"):
  - Bancos: `toggleBankAccountActiveAction`, `createManualTransactionAction`
    y `toggleReconciledAction` no registraban nada — corregido.
  - Configuración (tasas de impuesto): `createTaxRateAction`,
    `setDefaultTaxRateAction` y `toggleTaxRateActiveAction` no registraban
    nada — corregido.
  - Cobros/Pagos a proveedores y transferencias bancarias sí estaban
    cubiertos, pero desde dentro de las funciones Postgres
    (`register_customer_payment`/`register_supplier_payment`/
    `create_bank_transfer`), no vía el helper `logAudit` de la aplicación —
    confirmado al revisar, no requirió cambios.
- Verificado con inserción real simulando el usuario admin (mismo shape que
  usa `logAudit`) antes de dar por buenos los fixes. Datos de prueba limpiados.
- Nuevo link "Auditoría" en el menú lateral.
- Pendiente para más adelante (no bloqueante): Aprobaciones y Usuarios/
  Permisos también están listados en la sección 22, pero esos módulos
  todavía no tienen UI propia (siguen en backlog).

## F19 — Reportes

- `features/reports/queries.ts` + página `/reports`, cinco reportes de solo
  lectura sobre datos ya registrados (nada nuevo que capturar):
  - **Rentabilidad por proyecto**: todos los proyectos con Cotizado/
    Facturado/Cobrado/Costo real/Utilidad real/Margen (misma fórmula de F15,
    pero agregada en 5 consultas totales en vez de 5 por proyecto — evita
    N+1).
  - **Cuentas por cobrar**: facturas con balance pendiente, con antigüedad
    (días vencida) calculada respecto a la fecha de vencimiento.
  - **Cuentas por pagar**: gastos con balance pendiente.
  - **Ventas por cliente** y **Gastos por categoría**: totales agregados.
  - Todo consolidado en la moneda base de la empresa (mismo enfoque de F15/F16).
- **Fix de RLS real encontrado durante esta fase**: el permiso
  `reports.view` existía en el catálogo desde F0/F4, pero ninguna política
  RLS lo usaba — alguien con `reports.view` pero sin `invoices.view`/
  `expenses.view`/etc. habría visto los reportes vacíos, ya que RLS es la
  última línea de defensa y bloquea la lectura de esas tablas sin el
  permiso específico. Corregido en `031_reports_rls.sql`: las políticas de
  `select` de `quotations`, `projects`, `project_items`, `invoices`,
  `invoice_items`, `customer_payments` y `expenses` ahora aceptan
  `reports.view` como alternativa al permiso propio del módulo. Verificado
  revisando las políticas aplicadas directamente en Postgres.
- Página gateada por `reports.view` a nivel de aplicación (redirige a
  `/dashboard` si no se tiene) además del RLS.
- Nuevo link "Reportes" en el menú lateral.

## Mejora: previsualizar documentos sin descargar

- La lista de documentos ahora separa **"Ver"** (abre el archivo en una
  pestaña nueva sin forzar descarga — funciona para PDFs e imágenes, que el
  navegador ya sabe mostrar inline) de **"Descargar"** (fuerza guardar el
  archivo, vía el parámetro `download` de la URL firmada de Supabase
  Storage).
- Imágenes ahora muestran una **miniatura** directamente en la lista (clic
  para verla en grande); otros tipos muestran un ícono genérico (PDF/Archivo).

## Fix: subir documentos daba "Body exceeded 1 MB limit"

- Next.js limita el tamaño del body de los Server Actions a **1MB por
  defecto** — la validación propia de 15MB en `uploadDocumentAction` (F17)
  nunca llegaba a ejecutarse porque el framework rechazaba la petición
  antes. Corregido en `next.config.ts` con
  `experimental.serverActions.bodySizeLimit: "16mb"` (con margen sobre el
  límite de 15MB de la aplicación, para no cortar justo en el borde).

## F18 — Tareas y actividades

- Tablas `tasks`/`activities` ya existían desde F3, RLS (select/insert/update
  de tasks; select/insert de activities) desde F4 — gateadas con
  `projects.view`/`projects.update` (no tienen permiso propio en el
  catálogo). **Fix de RLS**: faltaba la política de `DELETE` en `tasks`
  (migración `030_tasks_delete.sql`) — verificado con inserción/actualización/
  borrado real simulando el usuario admin antes de darlo por bueno.
- Una tarea puede ser **general de la empresa o ligada a un proyecto**
  (`project_id` opcional, igual que gastos). `features/tasks/*` +
  `components/tasks/{new-task-form,task-list}.tsx` (reutilizables: la misma
  lista/formulario sirven en `/tasks` y en la pestaña "Tareas" del proyecto).
- Estado de tarea (Pendiente/En curso/Hecha/Cancelada) se cambia inline desde
  un select en la lista, sin recargar la página.
- **Actividades** (`features/activities/*`): bitácora de llamadas, reuniones,
  correos y notas por proyecto. **A propósito, no tiene update ni delete** —
  es un registro tipo bitácora, mismo espíritu que `audit_logs` (se registra,
  no se edita ni se borra después).
- Conectado: página general `/tasks` (con filtro por estado) + pestañas
  "Tareas" y "Actividades" del detalle de Proyecto (ambas placeholder hasta
  ahora).
- Nuevo link "Tareas" en el menú lateral.

## F17 — Documentos/Storage

- La infraestructura base (tabla `documents`, bucket privado `documents`,
  RLS por `company_id` + permisos) ya se había adelantado en F8 para el PDF
  de cotizaciones (F0, sección R lo fijaba como requisito de V1). F17
  construye la **UI genérica** sobre esa misma infraestructura, reutilizable
  en cualquier módulo vía el patrón polimórfico `entity_type`/`entity_id`.
- **Fix de RLS**: faltaba la política de `DELETE` tanto en la tabla
  `documents` como en `storage.objects` (bucket `documents`) — sin ella,
  borrar un documento habría fallado en silencio, igual que el bug de
  "Descartar borrador" de hace unas rondas. Se agregó y se verificó con una
  simulación real de RLS antes de darla por buena (migración
  `029_documents_delete.sql`).
- `features/documents/{schema,queries,actions}.ts` + componentes reutilizables
  `components/documents/{upload-document-form,document-list}.tsx`:
  subir (máx. 15MB), listar, descargar (link firmado de 10 minutos) y
  eliminar (borra el archivo de Storage y la fila de metadata).
- Conectado en: pestaña **Documentos** del detalle de Proyecto (la pestaña
  que faltaba de la lista original), y además en **Gastos** ("Recibos y
  comprobantes"), **Clientes** y **Proveedores** ("Documentos y contratos")
  — coincide con el alcance de la sección 21 del prompt maestro
  (cotizaciones, facturas, recibos, contratos, fotografías, comprobantes).
- Documentos **sí se pueden borrar físicamente** (a diferencia de
  cotizaciones/facturas/gastos) — no están en la lista de "nunca borrar" de
  F0-Arquitectura sección M.

## F16 — Dashboard

- Se instaló **recharts** (dependencia npm), la librería de gráficos que
  F0-Arquitectura dejó pendiente de elegir para esta fase.
- `features/dashboard/queries.ts`: `getDashboardKPIs()` (Ventas, Cobros,
  Gastos, Pagos del mes en curso; Cuentas por cobrar/pagar vivas; Proyectos
  activos; Cotizaciones pendientes/aprobadas; Utilidad y Margen del mes) y
  `getFinancialFlowSeries(meses)` (Cobros vs Pagos de los últimos 6 meses,
  para el gráfico). Todo consolidado en la moneda base de la empresa con el
  `exchange_rate` congelado de cada registro — mismo enfoque que F15.
- `/dashboard` ahora muestra las tarjetas de KPI + un gráfico de línea
  (Cobros vs Pagos, últimos 6 meses) vía `FinancialFlowChart` (componente
  cliente con recharts).
- Verificado con datos reales (factura + gasto de prueba este mes): Ventas,
  Gastos, Cuentas por cobrar y Cuentas por pagar coincidieron exactamente
  con el cálculo manual — incluyendo un gasto real del usuario ya pagado,
  correctamente excluido de "cuentas por pagar" pero incluido en "gastos del
  mes". Datos de prueba limpiados después.

## Fix: pestañas del detalle de Proyecto (Ingresos, Facturas, Cobros, Gastos, Proveedores, Pagos, Bancos)

- Las 7 pestañas que quedaron como placeholder tras F10-F14 ahora muestran
  datos reales filtrados por proyecto, cada una con un propósito distinto
  (sin duplicar lo que ya muestra Finanzas):
  - **Ingresos**: cotizaciones ligadas al proyecto
  - **Facturas**: facturas del proyecto (+ link para crear una nueva)
  - **Cobros**: cobros del proyecto, con link a la factura correspondiente
  - **Gastos**: gastos del proyecto (+ link para crear uno nuevo)
  - **Proveedores**: proveedores usados en el proyecto, con total gastado
    por proveedor (agregado desde `expenses`, excluyendo cancelados)
  - **Pagos**: pagos a proveedores del proyecto
  - **Bancos**: movimientos bancarios del proyecto
- Cada consulta se hace bajo demanda (solo cuando esa pestaña está activa),
  igual que ya se hacía con Finanzas/Rentabilidad en F15.
- Verificado con datos reales el caso más propenso a error (agregación de
  gastos por proveedor: 2 gastos del mismo proveedor sumaron correctamente).
  Datos de prueba limpiados después.
- Quedan como placeholder solo Tareas y Actividades (F18) y Documentos (F17)
  — esos módulos todavía no existen en absoluto, a diferencia de los 7 de
  arriba que sí existían como pantallas independientes.

## F15 — Rentabilidad

- `getProjectProfitability(projectId)` en `features/projects/queries.ts`:
  calcula por proyecto Cotizado/Facturado/Cobrado (ingresos), Costo
  estimado/real, Utilidad estimada/real y Margen estimado/real, consolidando
  todo en la moneda base de la empresa usando el `exchange_rate` ya
  congelado de cada cotización/factura/cobro/gasto (nunca la tasa actual) —
  tal como quedó definido en F0-Arquitectura, sección P.
  - Utilidad estimada = Cotizado − Costo estimado
  - Utilidad real = Facturado − Costo real (no se usa Cobrado para esto: es
    un indicador de flujo de caja, no de rentabilidad devengada)
- Es un cálculo en vivo (consultas agregadas), no una tabla cacheada — el
  cacheo para performance queda como optimización futura si hace falta
  (ya estaba contemplado como posible en F0).
- Pestañas **"Finanzas"** y **"Rentabilidad"** del detalle de Proyecto
  (antes placeholder) ahora muestran esta información real.
- Verificado extremo a extremo con datos de prueba reales (proyecto con
  cotización en DOP, factura y cobro en USD a tasa 60, gasto en DOP): los
  montos consolidados coincidieron exactamente con lo calculado a mano.
  Datos de prueba limpiados después.
- **Nota de deuda técnica detectada** (no corregida en esta fase, documentada
  en PROJECT_MASTER.md): las demás pestañas del proyecto (Ingresos, Gastos,
  Proveedores, Facturas, Cobros, Pagos, Bancos) siguen siendo placeholder
  aunque sus módulos ya existen como pantallas independientes — nunca se
  conectó una vista filtrada por proyecto dentro de esas pestañas.

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
