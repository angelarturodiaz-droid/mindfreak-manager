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

Se configura en F21. Estructura ya presente en `tests/unit`,
`tests/integration`, `tests/e2e`.

## Deployment

Se define en F23.
