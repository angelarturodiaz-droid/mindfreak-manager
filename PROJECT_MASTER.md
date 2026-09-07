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
| F5–F23 | ⬜ Pendiente |

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

## Deuda técnica

- Varios FKs (mayormente `created_by`/`approved_by`/`updated_by`, poco consultados) sin
  índice de cobertura. Nivel INFO en los *advisors* de Supabase, base de datos aún sin
  tráfico real. Revisar con datos de uso real en **F22 — Optimización**.
- El sandbox de desarrollo no tiene salida de red hacia `*.supabase.co`, así que el
  login real (navegador/Node) no pudo probarse end-to-end aquí; RLS se validó
  simulando el rol `authenticated` de Postgres directamente vía SQL (login real,
  bloqueo/permiso por rol, todo confirmado). Validar una vez el usuario corra
  `npm run dev` localmente.
- Permisos `.update`/`.delete` dedicados faltan para invoices/customer_payments/
  supplier_payments/quotations (RLS reutiliza el permiso `.create`/`.update` más
  cercano por ahora). Revisar si hace falta mayor granularidad al implementar F10-F13.

## Decisiones pendientes

- Falta crear el primer usuario real (ADMIN) — Auth es interno, sin registro público
  (sección I). Pendiente: email de la primera cuenta admin de Mindfreak Events.

- Confirmar HEX exacto del teal de marca si aparece guía oficial (no bloqueante).
- Disparador exacto de conversión LEAD→ACTIVE (automático al aprobar cotización
  vs. manual): se define en F5.
- Trigger de auditoría (genérico vía trigger de Postgres vs. capa de aplicación): se define en F4.
