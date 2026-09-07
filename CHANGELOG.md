# CHANGELOG — Mindfreak Manager

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
