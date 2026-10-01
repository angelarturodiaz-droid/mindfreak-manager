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

Archivo esperado: `.env.local` (no versionado). Ver `.env.example` para la
lista completa y de dónde sacar cada valor (Dashboard de Supabase >
Settings > API Keys):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
```

`SUPABASE_SECRET_KEY` solo es necesaria para crear/gestionar usuarios desde
Configuración → Usuarios (API de administración de Auth) — el resto del
sistema funciona sin ella. Nunca se expone al cliente, nunca se sube a git.

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

El proyecto es un Next.js estándar — no depende de ninguna plataforma en
particular. `npm run build && npm start` funciona igual en Vercel,
Cloudflare Pages, Azure (App Service o Container Apps), o cualquier host
que corra Node.js 20+. Las únicas variables que necesita cualquier
plataforma son las 3 de la sección "Variables de entorno" arriba.

**Nota de portabilidad**: la generación de PDFs (`@react-pdf/renderer`,
usado en Cotizaciones/Facturas) necesita runtime de Node.js completo, no
el runtime "Edge/Workers" — en Azure esto no requiere nada especial (corre
Node completo por defecto); en Cloudflare Pages hay que habilitar
compatibilidad Node.js (`nodejs_compat`) o usar el adaptador
`@cloudflare/next-on-pages`. No afecta a Vercel.

### Opción actual: Vercel

Es donde está desplegado el proyecto hoy — cero configuración rara, plan
gratuito de sobra para este tamaño de proyecto.

1. Entra a [vercel.com](https://vercel.com) e inicia sesión con tu cuenta
   de GitHub.
2. **Add New → Project**, selecciona el repo `mindfreak-manager` de la
   lista (ya existe, no hay que importar nada nuevo) y dale **Import**.
   Vercel detecta automáticamente que es Next.js — no toca configurar
   build command ni output directory.
3. Antes de darle deploy, en **Environment Variables** agrega las **tres**
   que tienes en tu `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SECRET_KEY` (si ya la configuraste — sin ella, todo
     funciona excepto crear/gestionar usuarios desde Configuración)
4. Dale **Deploy**. Vercel corre el mismo `npm run build` que usamos aquí
   y te da una URL pública (`mindfreak-manager.vercel.app` o similar).
5. **A partir de ahí, cada push a `main` en GitHub dispara un deploy
   automático** — no hay que hacer nada más.

**Si el proyecto ya está desplegado y agregas una variable nueva después**
(como `SUPABASE_SECRET_KEY` más adelante): agregarla en Vercel no alcanza
sola — hay que ir a **Deployments** y darle **Redeploy** al último deploy
(o hacer un push nuevo) para que la tome. Las variables de entorno no se
aplican solas a un deploy que ya existe.

### Otras plataformas (cuando se decida)

Cloudflare Pages y Azure quedan como opciones abiertas para más adelante
— el código no tiene que cambiar para ninguna de las dos, solo la
configuración de despliegue (variables de entorno + la nota de
`nodejs_compat` de arriba si se elige Cloudflare Pages).

### Configuración pendiente en Supabase tras el primer deploy (cualquier plataforma)

La recuperación de contraseña (`resetPasswordForEmail`) usa la **Site URL**
configurada en el dashboard de Supabase (Authentication → URL
Configuration), no una URL fija en el código. Una vez tengas tu dominio de
producción (sea de Vercel, Cloudflare, Azure o uno propio):

1. Ve a tu proyecto en Supabase → **Authentication → URL Configuration**.
2. Cambia **Site URL** de `http://localhost:3000` a tu dominio real de
   producción.
3. Agrega ese mismo dominio a **Redirect URLs** (con `/**` al final si
   pide un patrón).

Sin este paso, los links del correo de "recuperar contraseña" seguirían
apuntando a `localhost` en producción.

### Dominio de producción y `APP_URL`

Dominio definido: **`https://business.mindfreakevents.com`** (ver
`claude/checklist-produccion.md` del proyecto). La app ya no depende de
`localhost` para los enlaces que envía:

- `lib/utils/app-url.ts` → `getAppUrl()` arma todos los enlaces externos
  con la variable **`APP_URL`**; si no existe, usa la dirección de la
  petición (comportamiento de antes). La usan:
  - encuesta de satisfacción: enlace `/encuesta/{token}` del correo, del
    mensaje de WhatsApp y del botón "Copiar enlace";
  - invitación y reenvío de invitación de usuarios
    (`/auth/confirm?next=/update-password`);
  - recuperación de contraseña.
- No hay ninguna URL fija en el código (la de `playwright.config.ts` es
  solo para las pruebas locales).

Pasos el día del despliegue:

1. **Cloudflare** → Workers & Pages → `mindfreak-manager` → **Settings →
   Domains & Routes** → *Add custom domain* → `business.mindfreakevents.com`
   (Cloudflare crea el registro DNS si el dominio está en Cloudflare; si el
   DNS está en otro proveedor, crear el CNAME que indique).
2. Mismo Worker → **Settings → Variables and Secrets**: agregar
   `APP_URL` = `https://business.mindfreakevents.com` (texto, sin `/` al
   final), junto con las demás (`NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`,
   `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`,
   `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`). Las
   `NEXT_PUBLIC_*` también deben estar en las variables de **build**
   (se incrustan al compilar). Después, volver a desplegar.
   - No poner `vars` en `wrangler.jsonc`: un `wrangler deploy` con `vars`
     reemplaza las variables de texto puestas en el panel.
3. **Supabase → Authentication → URL Configuration**: Site URL =
   `https://business.mindfreakevents.com`; en Redirect URLs agregar
   `https://business.mindfreakevents.com/**` (dejar
   `http://localhost:3000/**` para seguir probando en la Mac).
4. **Turnstile**: agregar `business.mindfreakevents.com` a los hostnames
   del widget.
5. **SMTP**: que `SMTP_FROM` sea una dirección del dominio
   (ej. `notificaciones@mindfreakevents.com`) con SPF/DKIM configurados,
   para que la encuesta no llegue a spam.
6. Verificar: enviar una encuesta de prueba → el enlace del correo y del
   WhatsApp debe empezar con `https://business.mindfreakevents.com/encuesta/`;
   abrirlo en el celular sin sesión. Invitar un usuario de prueba y pedir
   "recuperar contraseña" → los enlaces llevan el dominio.

Las encuestas ya creadas guardan solo el token, no el dominio: al cambiar
`APP_URL`, "Copiar enlace" y los reenvíos usan el dominio nuevo.

### Dominio propio (opcional)

Se agrega en la configuración de dominios de la plataforma elegida (en
Vercel: **Settings → Domains**), y luego se actualiza la Site URL de
Supabase (paso anterior) con ese dominio.

