# Mindfreak Manager

Plataforma de gestión empresarial para **Mindfreak Events** (organización de
eventos). Ver `F0-Arquitectura-MindfreakManager.md` para la arquitectura
completa y `PROJECT_MASTER.md` para el estado actual del proyecto.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS v4
- Supabase (PostgreSQL 17, Auth, Storage, Row Level Security) — se conecta en F2
- Vitest (unit/integration) + Playwright (E2E) — se configura en F21

## Requisitos

- Node.js 20+
- Cuenta y proyecto de Supabase (ya creado: `mindfreak-manager`)

## Instalación

```bash
npm install
```

## Variables de entorno

Se agregan en F2 (conexión a Supabase). Archivo esperado: `.env.local`
(no versionado) con, como mínimo:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

## Desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## Build de producción

```bash
npm run build
npm start
```

## Supabase

Migraciones en `supabase/migrations`, seed en `supabase/seed`. Se define en
detalle en F2–F3.

## Testing

**Unit tests** (Vitest) — funciones puras de cálculo financiero
(subtotales, impuestos, totales). No requieren red ni Supabase:

```bash
npm test          # corre una vez
npm run test:watch
```

**E2E tests** (Playwright) — flujos reales de UI (login, crear cliente,
crear cotización). Requieren:

1. `npm run dev` corriendo en otra terminal (o dejar que Playwright lo
   levante solo, ya configurado en `playwright.config.ts`).
2. Un usuario de prueba: copiar `.env.test.example` a `.env.test` y
   completar `E2E_ADMIN_EMAIL`/`E2E_ADMIN_PASSWORD` (preferir un usuario de
   prueba, no el admin real — `.env.test` nunca se sube a git).
3. La primera vez, instalar los navegadores de Playwright:
   `npx playwright install chromium`.

```bash
npm run test:e2e
```

**Nota de alcance**: no hay tests de integración automatizados contra
Supabase real en este repo — el entorno de build no tiene acceso de red a
Supabase. En su lugar, cada función Postgres transaccional
(`register_customer_payment`, `register_supplier_payment`,
`create_bank_transfer`) y cada política RLS nueva se verificó manualmente
con datos de prueba reales antes de dar por buena cada fase (ver
`CHANGELOG.md` para el detalle de cada verificación).

## Deployment

Se recomienda **Vercel** (misma empresa que Next.js — cero configuración
rara, plan gratuito de sobra para este proyecto).

1. Entra a [vercel.com](https://vercel.com) e inicia sesión con tu cuenta
   de GitHub.
2. **Add New → Project**, selecciona el repo `mindfreak-manager` de la
   lista (ya existe, no hay que importar nada nuevo) y dale **Import**.
   Vercel detecta automáticamente que es Next.js — no toca configurar
   build command ni output directory.
3. Antes de darle deploy, en **Environment Variables** agrega las mismas
   dos que tienes en tu `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
4. Dale **Deploy**. Vercel corre el mismo `npm run build` que usamos aquí
   y te da una URL pública (`mindfreak-manager.vercel.app` o similar).
5. **A partir de ahí, cada push a `main` en GitHub dispara un deploy
   automático** — no hay que hacer nada más.

### Configuración pendiente en Supabase tras el primer deploy

La recuperación de contraseña (`resetPasswordForEmail`) usa la **Site URL**
configurada en el dashboard de Supabase (Authentication → URL
Configuration), no una URL fija en el código. Una vez tengas tu dominio de
Vercel:

1. Ve a tu proyecto en Supabase → **Authentication → URL Configuration**.
2. Cambia **Site URL** de `http://localhost:3000` a tu dominio real de
   producción.
3. Agrega ese mismo dominio a **Redirect URLs** (con `/**` al final si
   pide un patrón).

Sin este paso, los links del correo de "recuperar contraseña" seguirían
apuntando a `localhost` en producción.

### Dominio propio (opcional)

Si más adelante quieres algo como `manager.mindfreakevents.com` en vez del
subdominio de Vercel, se agrega en **Settings → Domains** del proyecto en
Vercel, y luego se actualiza la Site URL de Supabase (paso anterior) con
ese dominio.
