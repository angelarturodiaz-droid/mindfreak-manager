# PROJECT_MASTER — Mindfreak Manager

Referencia viva del proyecto. Se actualiza al final de cada fase (F1–F23).
La arquitectura completa y detallada vive en `F0-Arquitectura-MindfreakManager.md`
(documento de referencia, no se reescribe salvo cambios arquitectónicos aprobados).

## Objetivo

Plataforma de gestión empresarial para Mindfreak Events (organización de eventos):
clientes, proveedores, servicios, cotizaciones, proyectos/eventos, facturación,
cobros, gastos, pagos a proveedores, bancos, documentos, tareas, aprobaciones,
reportes, rentabilidad, usuarios/roles/permisos, auditoría, notificaciones y
configuración. No es un ERP completo — alcance V1 deliberadamente acotado
(ver sección R del documento de arquitectura).

## Stack

Next.js (App Router) + React + TypeScript + Tailwind CSS · Supabase (Postgres 17,
Auth, Storage, RLS) · Vitest + Playwright · Git/GitHub.

## Estado actual

| Fase | Estado |
|---|---|
| F0 — Arquitectura | ✅ Aprobada |
| F1 — Inicialización | ✅ Completada |
| F2 — Supabase | ✅ Completada |
| F3 — Base de datos | ✅ Completada |
| F4 — Seguridad | ✅ Completada |
| F5 — Clientes | ✅ Completada |
| F6 — Proveedores | ✅ Completada |
| F7 — Servicios | ✅ Completada |
| F8 — Cotizaciones | ✅ Completada |
| F9 — Proyectos/Eventos | ✅ Completada |
| F10 — Facturación | ✅ Completada |
| F11 — Cobros | ✅ Completada |
| F12 — Gastos | ✅ Completada |
| F13 — Pagos a proveedores | ✅ Completada |
| F14 — Bancos | ✅ Completada |
| F15 — Rentabilidad | ✅ Completada |
| F16 — Dashboard | ✅ Completada |
| F17 — Documentos/Storage | ✅ Completada |
| F18 — Tareas y actividades | ✅ Completada |
| F19 — Reportes | ✅ Completada |
| F20 — Auditoría | ✅ Completada |
| F21 — Testing | ✅ Completada (15 unit + 9 E2E, todos verificados corriendo) |
| F22 — Optimización | ✅ Completada |
| F23 — Deployment | ✅ Completada (guía lista; falta que el usuario conecte Vercel) |

## Decisiones arquitectónicas clave (ver F0 para detalle completo)

- Multiempresa desde el esquema (`company_id`), UI V1 solo para Mindfreak Events.
- **Multimoneda real**: `companies.base_currency` + `currency`/`exchange_rate`
  congelado por transacción en quotations, invoices, expenses, customer_payments,
  supplier_payments y bank_transactions.
- Clientes potenciales: `clients.status` (`LEAD`/`ACTIVE`), sin tabla separada.
- Saldo inicial de bancos: `bank_accounts.opening_balance` + `opening_balance_date`.
- Carga masiva de clientes vía CSV, con trazabilidad en `import_batches`.
- Presupuesto de proyecto (`projects.budget`) visible desde su creación, comparado
  en tiempo real contra gastos reales (Rentabilidad).
- Compartir cotización/factura: link de descarga vía URL firmada de Supabase
  Storage (V1). Portal de aprobación interactiva del cliente: V2.
- Design Tokens centralizados en `app/globals.css` (Tailwind v4, `@theme inline`):
  `brand-primary` (#000000), `brand-accent` (#17a6b8, estimado del logo — confirmar
  HEX exacto si aparece un archivo de marca oficial), y paleta funcional derivada.

## Estructura de carpetas

Ver sección D del documento de arquitectura. Implementada tal cual en F1.

## Módulo de Configuración — primera etapa

Construido tras F23, con la estructura que el usuario definió (acceso vía
ícono de engranaje arriba a la derecha, no menú lateral). Pestañas:

- **Organización**: nombre legal, RNC, dirección, teléfono, correo, moneda
  base (`companies.address`/`phone`/`email` — columnas nuevas, migración
  `034_settings_organization.sql`).
- **Impuestos**: ya existía (`/settings/tax-rates`, F19/tax_rates), solo se
  colgó dentro del layout de pestañas.
- **Categorías de gastos**: gap real encontrado — la tabla
  `expense_categories` existía desde F3 pero nunca tuvo pantalla propia.
  Construida con crear/listar/eliminar (muestra cuántos gastos usan cada
  categoría antes de dejar eliminar).
- **Sistema**: nombre de la plataforma, colores de marca, logo (bucket
  público nuevo `branding`, distinto al privado `documents` de F8, para que
  la URL del logo no dependa de un link firmado que expira).
- **Notificaciones, Documentos, Seguridad, Usuarios**: páginas informativas
  honestas sobre qué aplica y qué no (ver tabla de backlog) — Usuarios
  muestra el listado real (solo lectura) de usuarios y roles.

**Verificación**: Organización y Categorías de gastos se probaron con
inserción/actualización/borrado real bajo RLS simulando el usuario admin —
funcionan. **La subida de logo (bucket `branding`) no se pudo verificar por
esta vía**: al probar un INSERT directo a `storage.objects` para simular la
subida, falló con "violates row-level security policy" incluso con una
política de prueba trivial (`with check (true)`) — se investigó a fondo
(triggers, grants, políticas restrictivas, todo descartado) sin encontrar la
causa real; parece ser una restricción de la herramienta de SQL directo
sobre esa tabla específica, no necesariamente un bug de la política en sí
(que sigue exactamente el mismo patrón ya probado y funcionando del bucket
`documents`). **Pendiente que el usuario confirme en la app real** que subir
un logo funciona; si falla, revisar la política `branding_storage_insert`
primero. Queda un registro de metadata huérfano (`logo-test-noauth.png`, sin
archivo real detrás) en el bucket `branding` de la prueba — inofensivo, no
se pudo borrar por SQL directo (protegido por trigger de Supabase Storage).

## Rediseño de interfaz (ERP SaaS) — en curso, por etapas

Brief completo del usuario: rediseño visual total (estilo Odoo/ERPNext/Zoho)
sin tocar funcionalidad/lógica/datos/rutas/permisos. Alcance real: ~40
pantallas. Se aborda en rondas, no en una sola.

**✅ Etapa 1 (completada)**: Design System (`app/globals.css` — negro/blanco/
azul claro + semánticos + estados), librería de componentes
(`components/ui/`: Button, Badge, Input/Select/Textarea, Card/KpiCard,
EmptyState, Skeleton, Modal, ConfirmButton, Toaster, DataTable), `lucide-react`
+ `sonner` instalados, Sidebar rediseñado (agrupado, íconos, colapsable,
activo/hover), Dashboard rediseñado (KpiCard + accesos rápidos).

**✅ Etapa 2 (completada)**: módulo **Clientes** — lista (`DataTable`,
`Badge`, `Input`/`Select` para filtros, `EmptyState`), detalle (`Badge` de
estado, `ConfirmButton` en vez de `window.confirm` para desactivar/eliminar
contacto), formularios (nuevo/editar cliente, nuevo contacto, importar CSV)
usando `Input`/`Select`/`Button` — sin tocar ninguna acción, query ni ruta.

**✅ Etapa 3 (completada)**: módulo **Cotizaciones** — lista, detalle
(botones de flujo con `Button`, `ConfirmButton` para cancelar/descartar,
`DataTable` para líneas, tarjeta de totales), formularios (nuevo, línea) y
botones auxiliares (compartir/duplicar/descartar) migrados al Design
System. `ShareLinkButton` ahora usa `toast` en vez de mensajes de error
inline.

**✅ Etapa 4 (completada)**: módulo **Proyectos** — el archivo más grande del
proyecto (770 líneas, 13 pestañas: Resumen/Finanzas/Ingresos/Gastos/
Proveedores/Facturas/Cobros/Pagos/Bancos/Tareas/Documentos/Actividades/
Rentabilidad), reescrito completo con `DataTable`/`Badge`/`KpiCard`/
`Button`/`ConfirmButton` en las 13 pestañas. También: lista de proyectos,
formularios (nuevo proyecto, editar, línea, convertir cotización, nueva
actividad) y el componente `ActivityItem` (con editar/eliminar).

**✅ Etapa 5 (completada)**: módulo **Facturas** — lista, detalle (líneas +
cobros con `DataTable`, tarjeta de totales), formularios (nueva, línea,
NCF/vencimiento, registrar cobro) y botones auxiliares (compartir/duplicar/
descartar, con `toast` en vez de mensajes inline) migrados al Design System.

**✅ Etapa 6 (completada)**: módulo **Cobros/Pagos** (`/payments`) — las dos
tablas (Cobros, Pagos a proveedores) migradas a `DataTable`. Los
formularios de registro ya estaban migrados (viven en Facturas/Gastos).

**✅ Etapa 7 (completada)**: módulo **Gastos** — lista, detalle (`KpiCard`
para subtotal/impuesto/total/balance, `ConfirmButton` para cancelar,
`DataTable` para historial de pagos) y formularios (nuevo, editar,
registrar pago a proveedor) migrados al Design System.

**✅ Etapa 8 (completada)**: módulo **Proveedores** — lista, detalle y
formularios (nuevo, editar, nuevo contacto) migrados al Design System.

**✅ Etapa 9 (completada)**: módulo **Productos y Servicios** — lista,
detalle y formularios (nueva categoría, nuevo producto/servicio, editar)
migrados al Design System.

**✅ Etapa 10 (completada)**: módulo **Bancos** — lista y detalle (ya
estaban parcialmente migrados de una ronda anterior sin commitear) +
formularios (nueva cuenta, movimiento manual, transferencia) migrados al
Design System.

**✅ Etapa 11 (completada)**: módulo **Tareas** — página `/tasks` y los dos
componentes compartidos `NewTaskForm`/`TaskList` (usados también en la
pestaña "Tareas" de Proyectos) migrados al Design System, incluyendo
reemplazar `window.confirm()` por `ConfirmButton` en eliminar tarea.

**⬜ Pendiente (próximas etapas)**: Reportes → Auditoría → Configuración →
Login.

## Backlog

| Idea | Módulo | Prioridad | Alcance |
|---|---|---|---|
| Alerta de presupuesto (gasto real vs. `projects.budget`) | Proyectos / Rentabilidad / Notificaciones | Media | Se revisa en F9/F15 |
| Marcar cotizaciones como `EXPIRED` automáticamente cuando pasa `valid_until` sin respuesta (hoy no hay botón ni proceso automático — se usa Rechazar/Cancelar manualmente mientras tanto) | Cotizaciones | Baja | F8 (revisar) o job automático futuro |
| Módulo de Configuración — **primera etapa construida** (ver sección
  dedicada más abajo): Organización, Impuestos, Categorías de gastos,
  Sistema. Acceso vía ícono de engranaje en la esquina superior derecha,
  como se pidió. **Pendiente para una ronda aparte**: Usuarios/Roles reales
  (invitar/gestionar — sensible, toca autenticación), Notificaciones reales
  (sigue V2), Campos personalizados y Mantenimiento (fuera de alcance V1).
  NCF/ITBIS como activación fiscal completa sigue V2. Documentos con
  tipos/plantillas/numeración no aplica al diseño actual del sistema. |
  Configuración | Media-Alta | Primera etapa completada; Usuarios queda
  pendiente por su sensibilidad |
| Campana de notificaciones en la barra superior (contador de no leídas + panel desplegable + marcar como leída). La tabla `notifications` ya existe desde F3/F4 con RLS (cada quien ve solo las suyas) — falta la UI y quién dispara cada notificación (ej. factura por vencer, tarea asignada, alerta de presupuesto ya listada arriba, cotización por expirar) | Notificaciones | Media | Sin número de fase propio en el plan F1-F23 (módulo 21 de la sección 10) — se agenda cuando se aborde, probablemente junto a F16 (Dashboard) |
| **Manual de usuario del sistema**: documento explicando cómo funciona cada módulo (Clientes, Cotizaciones, Proyectos, Facturas, Cobros, Gastos, Pagos, Bancos, etc.) y el flujo completo del proceso de negocio de punta a punta (Cliente → Cotización → Proyecto → Factura → Cobro, y en paralelo Proyecto → Gastos → Proveedores → Pagos → Banco). Es un documento para el USUARIO final (equipo de Mindfreak Events), distinto de `README.md` (que es técnico, para desarrolladores) | Documentación | Media | Pedido explícitamente para el cierre del proyecto, después de F23 (Deployment) — cuando todos los módulos estén construidos y el flujo sea el definitivo |

## Deuda técnica

- **Accesibilidad de formularios**: la mayoría de los `<label>` en el
  proyecto no están asociados a su `<input>` vía `htmlFor`/`id` (excepto
  los formularios de autenticación). Detectado al escribir los tests E2E de
  F21 — no afecta la funcionalidad, pero sí a lectores de pantalla y a
  `getByLabel()` de Playwright (por eso los tests E2E usan selectores por
  `name` en vez de por label). No se corrige ahora (tocaría decenas de
  formularios); queda para una ronda dedicada de accesibilidad.
- ~~Varios FKs sin índice de cobertura~~ — **resuelto en F22** (61 índices agregados).
- El sandbox de desarrollo no tiene salida de red hacia `*.supabase.co`, así que el
  login real (navegador/Node) no pudo probarse end-to-end desde aquí; se validó
  RLS simulando el rol `authenticated` de Postgres vía SQL. **El usuario lo probó
  en su Mac y funciona** (ver más abajo el detalle de un bug real que apareció y
  se corrigió).
- Permisos `.update`/`.delete` dedicados faltan para invoices/customer_payments/
  supplier_payments/quotations (RLS reutiliza el permiso `.create`/`.update` más
  cercano por ahora). Revisar si hace falta mayor granularidad al implementar F10-F13.

## Incidentes resueltos

- **"Descartar borrador" no borraba nada** (detectado por el usuario al
  probar): faltaba la política RLS de `delete` en `quotations`/`invoices` —
  sin ella, Postgres deniega el borrado por defecto sin lanzar error, así
  que el `.delete()` "funcionaba" pero afectaba 0 filas. Corregido con la
  migración `025_delete_draft_documents.sql` (política de delete restringida
  a `status='DRAFT'`), verificado con simulación real de RLS vía SQL. Las
  Server Actions ahora también verifican que el delete afectó una fila y
  lanzan error explícito si no, para detectar problemas similares de inmediato.

- **Botones nuevos (PDF/Duplicar) no aparecían tras `git pull` + reinicio del
  servidor** (detectado al probar la ronda de correcciones post-F10/F11): no
  era un bug de código — el build compilaba limpio y el componente no tenía
  ninguna condición que lo ocultara. Se resolvió con `rm -rf .next` +
  reiniciar `npm run dev` y refresco forzado del navegador (caché de
  Turbopack/navegador). **Para futuros casos similares**: si un cambio ya
  pusheado y compilado no aparece en local tras `git pull`, probar primero
  `rm -rf .next` antes de asumir un bug real.

- **Login fallaba con "Database error querying schema"** (F4, detectado al probar
  en local): el usuario ADMIN se creó insertando directo en `auth.users` por SQL
  (no había API de administración de usuarios disponible), y quedaron varias
  columnas de texto (`email_change`, `phone_change`, `reauthentication_token`, etc.)
  en `NULL` en vez de `''`. El driver de Go de Supabase Auth no soporta `NULL` en
  esas columnas y fallaba al leer el usuario. Corregido con un `UPDATE` que las
  puso en cadena vacía. También faltaba la fila correspondiente en
  `auth.identities` (necesaria para el login por contraseña), que se agregó.
  **Para usuarios futuros**: usar el flujo normal de invitación/registro de
  Supabase Auth evita este problema — este fue un caso único de sembrar el primer
  usuario manualmente sin tener acceso a la API de administración.
- **404 al entrar al detalle de un proyecto** (F9, detectado al probar en local):
  `projects` y `quotations` tienen dos FKs cruzadas entre sí
  (`projects.quotation_id → quotations.id` y `quotations.project_id →
  projects.id`, por el diseño de F3 para permitir la conversión sin dato
  circular). PostgREST no podía resolver la ambigüedad al pedir el embed
  `quotations(number)` desde `projects` y fallaba con error, que el código
  interpretaba como "no encontrado". Corregido especificando la FK exacta:
  `quotations!quotation_id(number)`. **Lección para futuros embeds**: cualquier
  par de tablas con más de una relación entre sí necesita este hint explícito.

## Ronda post-F10/F11 (impuestos, PDF y duplicar)

Ver detalle completo en `CHANGELOG.md`. Resumen: tabla `tax_rates` (ITBIS 18%
predeterminada + Exento 0%, parametrizable desde `/settings/tax-rates`), PDF +
link para compartir en facturas (antes solo existía en cotizaciones — era un
gap real de F10), botón "Descargar PDF" en ambos, y "Duplicar
cotización"/"Duplicar factura" (nuevo documento en BORRADOR con las líneas
copiadas, el original nunca se toca).

Ajuste posterior: el selector de tasas (`tax_rates`) se revirtió a un campo
manual — pero como **porcentaje** (ej. escribir `18` = ITBIS 18%), calculado
automáticamente por el servidor sobre (cantidad×precio − descuento). La tabla
`tax_rates` y `/settings/tax-rates` quedan construidas pero sin usarse en las
líneas por ahora, listas para cuando se aborde el módulo de Configuración.

También se agregó "Descartar borrador" en cotizaciones y facturas: mientras
el documento esté en estado BORRADOR (antes de enviarlo/emitirlo), se puede
eliminar por completo en vez de solo "Cancelar" (que lo deja registrado para
siempre). Diferencia clave: Cancelar = soft-state, conserva el número y el
registro para auditoría (documento con algo de actividad real); Descartar =
borrado físico, solo disponible en BORRADOR (sin actividad real todavía).

## Decisiones pendientes

- Confirmar HEX exacto del teal de marca si aparece guía oficial (no bloqueante).
- Disparador exacto de conversión LEAD→ACTIVE (automático al aprobar cotización
  vs. manual): se define en F5.
- Trigger de auditoría (genérico vía trigger de Postgres vs. capa de aplicación): se define en F4.
- **Recomendación pendiente (no bloqueante)**: activar "Leaked Password
  Protection" en Supabase Auth (Dashboard → Authentication → Policies) — se
  detectó en los *advisors* de seguridad en F11, es una configuración del
  proyecto, no algo que se resuelva por migración.

## Usuarios

- `adiaz@mindfreakevents.com` — rol ADMIN, Mindfreak Events. Cuenta creada en F4
  con contraseña temporal (entregada directamente, no por este documento).

## Infraestructura adelantada de fases futuras

- **Bucket de Supabase Storage `documents`** (privado) y sus políticas RLS se
  crearon en F8, no en F17, porque el requisito de "PDF + link de descarga"
  para cotizaciones (fijado en F0) los necesitaba ya. F17 construirá la UI
  genérica de gestión de documentos sobre esta misma infraestructura.
