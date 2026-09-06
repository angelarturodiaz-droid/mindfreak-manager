# CHANGELOG — Mindfreak Manager

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
