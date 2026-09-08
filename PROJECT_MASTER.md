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
| F12–F23 | ⬜ Pendiente |

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

## Backlog

| Idea | Módulo | Prioridad | Alcance |
|---|---|---|---|
| Alerta de presupuesto (gasto real vs. `projects.budget`) | Proyectos / Rentabilidad / Notificaciones | Media | Se revisa en F9/F15 |
| Marcar cotizaciones como `EXPIRED` automáticamente cuando pasa `valid_until` sin respuesta (hoy no hay botón ni proceso automático — se usa Rechazar/Cancelar manualmente mientras tanto) | Cotizaciones | Baja | F8 (revisar) o job automático futuro |
| Módulo de Configuración completo con pestañas: **Empresa** (nombre legal, RNC, dirección, teléfono, correo, logo, moneda — faltan columnas `address`/`phone`/`email` en `companies`), **Impuestos** (✅ ya construido como `/settings/tax-rates`, solo falta integrarlo como pestaña), **Facturación** (numeración/prefijos, días de vencimiento por defecto, nota de pie de factura), **Notificaciones** (preferencias, el envío real de correo sigue V2), **Sistema** (nombre de plataforma, colores de marca — ya existen en `companies`, falta pantalla), **Integraciones** (placeholder informativo). Pendiente definir dónde va "Usuarios y Seguridad" (invitar/gestionar usuarios y roles, hoy solo por SQL manual) — el usuario no lo incluyó en la lista de pestañas, queda por confirmar si es una pestaña más, un módulo aparte, o se deja para después | Configuración | Media | Sin número de fase propio en el plan F1-F23 (módulo 22 de la sección 10) — se agenda cuando se aborde |
| Campana de notificaciones en la barra superior (contador de no leídas + panel desplegable + marcar como leída). La tabla `notifications` ya existe desde F3/F4 con RLS (cada quien ve solo las suyas) — falta la UI y quién dispara cada notificación (ej. factura por vencer, tarea asignada, alerta de presupuesto ya listada arriba, cotización por expirar) | Notificaciones | Media | Sin número de fase propio en el plan F1-F23 (módulo 21 de la sección 10) — se agenda cuando se aborde, probablemente junto a F16 (Dashboard) |

## Deuda técnica

- Varios FKs (mayormente `created_by`/`approved_by`/`updated_by`, poco consultados) sin
  índice de cobertura. Nivel INFO en los *advisors* de Supabase, base de datos aún sin
  tráfico real. Revisar con datos de uso real en **F22 — Optimización**.
- El sandbox de desarrollo no tiene salida de red hacia `*.supabase.co`, así que el
  login real (navegador/Node) no pudo probarse end-to-end desde aquí; se validó
  RLS simulando el rol `authenticated` de Postgres vía SQL. **El usuario lo probó
  en su Mac y funciona** (ver más abajo el detalle de un bug real que apareció y
  se corrigió).
- Permisos `.update`/`.delete` dedicados faltan para invoices/customer_payments/
  supplier_payments/quotations (RLS reutiliza el permiso `.create`/`.update` más
  cercano por ahora). Revisar si hace falta mayor granularidad al implementar F10-F13.

## Incidentes resueltos

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
