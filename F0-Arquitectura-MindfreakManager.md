# F0 — ARQUITECTURA — MINDFREAK MANAGER

**Empresa:** Mindfreak Events
**Plataforma (nombre provisional, configurable):** Mindfreak Manager
**Estado del repo/BD verificado:** GitHub vacío (0 commits) · Supabase vacío (0 tablas, 0 migraciones)
**Fecha:** F0 — Fase de Arquitectura, previo a cualquier implementación

> Este documento es para revisión. No contiene código. No se ha ejecutado ningún comando. Se espera la palabra **APROBADO** para iniciar F1.

---

## A. Arquitectura General

Arquitectura **modular monolítica** sobre Next.js, con Supabase como backend-as-a-service. Un solo repositorio (monorepo simple, no monorepo multi-paquete), organizado por *features* (módulos de negocio), no por tipo técnico de archivo.

Principios:
- **Server-first**: la mayoría de la lógica vive en Server Components / Server Actions. El cliente solo lleva interactividad real (formularios, tablas con filtros, modales).
- **Supabase como única fuente de verdad de datos**: Postgres + RLS + Auth + Storage. No se introduce un backend independiente (NestJS) salvo justificación futura real (ej. procesos batch pesados, integraciones externas complejas).
- **Multiempresa desde el día 1** a nivel de esquema (`company_id`), aunque la UI en V1 solo opere con una compañía (Mindfreak Events).
- **Todo dinero es NUMERIC**, nunca FLOAT.
- **Multimoneda real**: la empresa opera con una moneda base de consolidación (`companies.base_currency`, ej. DOP), pero cotizaciones, facturas, gastos, cobros, pagos y cuentas bancarias pueden operar en otra moneda (típicamente USD). Cada registro financiero **congela la tasa de cambio (`exchange_rate`) vigente al momento de la transacción**; nunca se recalcula retroactivamente con la tasa actual, para no distorsionar reportes ni rentabilidad histórica.
- **Todo cambio financiero relevante ocurre dentro de una transacción** (vía funciones Postgres `SECURITY DEFINER` o transacciones explícitas desde Server Actions), con rollback ante fallo parcial.
- **RLS como última línea de defensa real**, no el frontend.

## B. Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | Next.js (App Router) + React + TypeScript + Tailwind CSS |
| Backend | Server Actions + Route Handlers de Next.js (sin backend separado en V1) |
| Base de datos | Supabase (PostgreSQL 17) |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| Seguridad de datos | Row Level Security (RLS) |
| Control de versiones | Git + GitHub |
| Testing | Vitest (unit/integration) + Playwright (E2E) |
| Gráficos/Dashboard | Librería de charts sobre React (a definir en F16, ej. Recharts) |

## C. Diagrama de Arquitectura (alto nivel)

```
┌──────────────────────────────────────────────────────────────┐
│                        NAVEGADOR (Cliente)                    │
│   Next.js App Router · React · Tailwind · Design System       │
└───────────────┬─────────────────────────────┬─────────────────┘
                │ Server Components            │ Server Actions /
                │ (lectura)                    │ Route Handlers (escritura)
                ▼                              ▼
┌──────────────────────────────────────────────────────────────┐
│                     NEXT.JS (Servidor)                        │
│  - Autenticación (Supabase Auth helpers)                       │
│  - Validación de permisos (capa de aplicación)                 │
│  - Orquestación de transacciones financieras                   │
│  - Generación de PDFs (cotizaciones/facturas)                  │
└───────────────┬─────────────────────────────┬─────────────────┘
                │ Supabase Client (server-side, con sesión)      │
                ▼                              ▼
┌──────────────────────────────┐   ┌───────────────────────────┐
│         SUPABASE AUTH         │   │      SUPABASE STORAGE      │
│  Login/Logout/Sesión/Recovery │   │  Cotizaciones, facturas,    │
└──────────────────────────────┘   │  recibos, contratos, fotos  │
                │                   └───────────────────────────┘
                ▼
┌──────────────────────────────────────────────────────────────┐
│                    POSTGRESQL (Supabase)                      │
│  - Tablas de negocio (companies, clients, projects, etc.)      │
│  - Row Level Security por company_id + permisos                │
│  - Funciones/Triggers (auditoría, actualización de balances)   │
│  - Migraciones versionadas (Supabase CLI)                      │
└──────────────────────────────────────────────────────────────┘
```

## D. Estructura de Carpetas

Se adopta la estructura propuesta en el prompt (sección 27), con ligeros ajustes al convencionalismo de Next.js App Router:

```
/app
  /(auth)/login, /(auth)/recover-password
  /(dashboard)/dashboard
  /(dashboard)/clients
  /(dashboard)/suppliers
  /(dashboard)/services
  /(dashboard)/quotations
  /(dashboard)/projects
  /(dashboard)/invoices
  /(dashboard)/payments
  /(dashboard)/expenses
  /(dashboard)/banks
  /(dashboard)/reports
  /(dashboard)/settings
  /api/... (route handlers puntuales: webhooks, PDF export, etc.)

/components
  /ui            → Button, Input, Modal, Table, Badge, Tabs, etc.
  /layout        → Sidebar, Header, Shell

/features
  /clients, /suppliers, /services, /quotations, /projects,
  /invoices, /payments, /expenses, /banks, /reports
  (cada feature: components/, actions.ts, queries.ts, schema.ts, types.ts)

/lib
  /supabase      → clients (server/browser), middleware de sesión
  /auth          → helpers de permisos y roles
  /audit         → helper para registrar audit_logs
  /pdf           → generación de PDFs

/hooks
/types
/services        → clientes de servicios externos futuros
/utils

/supabase
  /migrations
  /seed

/tests
  /unit /integration /e2e

/public

PROJECT_MASTER.md
CHANGELOG.md
README.md
```

## E. Modelo de Datos — Visión General

El modelo se organiza en 12 dominios: Seguridad/Multiempresa, Clientes, Proveedores, Servicios, Cotizaciones, Proyectos, Facturación, Cobros, Gastos, Pagos a proveedores, Bancos, Soporte (Documentos/Tareas/Actividades/Aprobaciones/Auditoría/Notificaciones/Configuración).

Todas las tablas de negocio (excepto catálogos globales de permisos) incluyen `company_id`. Todas incluyen `created_at`, `updated_at`; las entidades financieras y de negocio relevantes incluyen `created_by`.

## F. ERD (relaciones principales, notación textual)

```
companies 1───* profiles (vía user_roles / company_id en profiles)
companies 1───* clients, suppliers, services, quotations, projects,
               invoices, expenses, bank_accounts, settings...

clients 1───* client_contacts
clients 1───* quotations
clients 1───* projects
clients 1───* invoices

suppliers 1───* supplier_contacts
suppliers 1───* expenses
suppliers 1───* supplier_payments

service_categories 1───* services
services 1───* quotation_items / project_items / invoice_items

quotations 1───* quotation_items
quotations 1───0..1 projects        (una cotización aprobada genera un proyecto)

projects 1───* project_items
projects 1───* invoices
projects 1───* expenses
projects 1───* tasks
projects 1───* activities
projects 1───* documents (vía entity_type/entity_id)

invoices 1───* invoice_items
invoices 1───* customer_payments

customer_payments *───1 bank_accounts (opcional)
customer_payments 1───* bank_transactions (generación automática)

expense_categories 1───* expenses
expenses 1───* supplier_payments
supplier_payments *───1 bank_accounts (opcional)
supplier_payments 1───* bank_transactions (generación automática)

bank_accounts 1───* bank_transactions

roles *───* permissions   (vía role_permissions)
profiles *───* roles      (vía user_roles, con company_id)

audit_logs *───1 profiles (usuario que ejecutó la acción)
approvals *───1 profiles (solicitante y aprobador)
notifications *───1 profiles
```

## G. Lista de Tablas

### Seguridad / Multiempresa

| Tabla | Propósito | PK | FK | Campos principales | Índices | Relaciones |
|---|---|---|---|---|---|---|
| `companies` | Empresas que usan la plataforma (multiempresa) | `id` | — | name, legal_name, tax_id, platform_name, logo_url, brand_primary, brand_accent, base_currency (moneda de consolidación/reportes, ej. DOP), is_active | `idx_companies_active` | 1─* con casi todas las tablas de negocio |
| `profiles` | Perfil de cada usuario autenticado (extiende `auth.users`) | `id` (=auth.users.id) | — | full_name, email, phone, avatar_url, is_active | — | 1─* user_roles |
| `roles` | Roles del sistema (Admin, Manager, Sales, Finance, Operations + futuros) | `id` | `company_id?` (null = rol global) | name, description, is_system | `idx_roles_company` | *─* permissions vía role_permissions |
| `permissions` | Catálogo granular de permisos (`clients.view`, `invoices.create`, etc.) | `id` | — | code (único), module, description | `uq_permissions_code` | *─* roles |
| `role_permissions` | Asignación permiso↔rol | (`role_id`,`permission_id`) | `role_id`→roles, `permission_id`→permissions | — | — | — |
| `user_roles` | Asignación usuario↔rol↔empresa | (`user_id`,`role_id`,`company_id`) | `user_id`→profiles, `role_id`→roles, `company_id`→companies | — | `idx_user_roles_company` | permite multiempresa por usuario |

### Clientes

| Tabla | Propósito | PK | FK | Campos principales | Índices | Relaciones |
|---|---|---|---|---|---|---|
| `clients` | Empresas/personas clientes (incluye clientes potenciales) | `id` | `company_id` | name, tax_id, email, phone, address, **status** (`LEAD` \| `ACTIVE`), is_active | `idx_clients_company`, `idx_clients_status` | 1─* client_contacts, quotations, projects, invoices |
| `client_contacts` | Contactos de un cliente | `id` | `client_id`, `company_id` | full_name, position, email, phone, is_primary | `idx_client_contacts_client` | *─1 clients |

> **Nota — Clientes potenciales:** un registro `clients` con `status = LEAD` es un cliente potencial (prospecto). Se convierte a `status = ACTIVE` cuando se concreta el primer negocio (por defecto: al aprobar su primera cotización o crear su primer proyecto), automáticamente o mediante un botón manual "Convertir a cliente" — el disparador exacto se define en F5 (Clientes). No se crea ninguna tabla nueva: leads y clientes activos son la misma entidad con distinto estado, lo que evita duplicar datos si un lead nunca se convierte, o mantenerlos separados si se prefiere filtrar el pipeline comercial (Dashboard/Reportes podrán mostrar "Leads" vs "Clientes activos" por separado).

> **Nota — Carga masiva CSV:** clientes (potenciales o activos) podrán importarse desde un archivo **CSV** (plantilla descargable con columnas esperadas: name, tax_id, email, phone, address, status). El proceso: subir archivo → previsualizar y mapear columnas → validar (duplicados por `tax_id`/`email`, campos requeridos) → confirmar → inserción transaccional. Cada importación queda registrada en `import_batches` (ver tabla abajo) para trazabilidad y para poder auditar o revertir una carga con errores. El mismo componente de importación se diseña reutilizable para otros módulos futuros (proveedores, servicios), evitando construirlo de nuevo cada vez.

### Proveedores

| Tabla | Propósito | PK | FK | Campos principales | Índices | Relaciones |
|---|---|---|---|---|---|---|
| `suppliers` | Proveedores | `id` | `company_id` | name, tax_id, category, email, phone, is_active | `idx_suppliers_company` | 1─* supplier_contacts, expenses, supplier_payments |
| `supplier_contacts` | Contactos de proveedor | `id` | `supplier_id`, `company_id` | full_name, position, email, phone, is_primary | `idx_supplier_contacts_supplier` | *─1 suppliers |

### Servicios

| Tabla | Propósito | PK | FK | Campos principales | Índices | Relaciones |
|---|---|---|---|---|---|---|
| `service_categories` | Categorías de servicio | `id` | `company_id` | name, description | — | 1─* services |
| `services` | Catálogo de servicios/productos ofrecidos | `id` | `company_id`, `category_id` | name, unit, default_price, default_cost, is_active | `idx_services_company` | referenciado por items de cotización/proyecto/factura |

### Cotizaciones

| Tabla | Propósito | PK | FK | Campos principales | Índices | Relaciones |
|---|---|---|---|---|---|---|
| `quotations` | Cotizaciones a clientes | `id` | `company_id`, `client_id`, `contact_id`, `project_id?` | number, issue_date, valid_until, status, subtotal, discount, tax, total, estimated_cost, estimated_margin, terms, **currency**, **exchange_rate** (tasa a base_currency vigente en issue_date) | `idx_quotations_client`, `idx_quotations_status` | 1─* quotation_items; 0..1─1 projects |
| `quotation_items` | Líneas de una cotización | `id` | `quotation_id`, `service_id?` | description, quantity, unit_price, discount, tax, subtotal, estimated_unit_cost | `idx_qi_quotation` | *─1 quotations |

### Proyectos / Eventos

| Tabla | Propósito | PK | FK | Campos principales | Índices | Relaciones |
|---|---|---|---|---|---|---|
| `projects` | Entidad central: el evento en sí | `id` | `company_id`, `client_id`, `contact_id`, `quotation_id?`, `manager_id`(profiles) | number, name, event_date, event_time, location_name, address, status, budget, notes | `idx_projects_client`, `idx_projects_status`, `idx_projects_date` | 1─* project_items, invoices, expenses, tasks, activities |
| `project_items` | Líneas de servicio del proyecto (heredadas de la cotización) | `id` | `project_id`, `service_id?` | description, quantity, unit_price, estimated_cost, subtotal | `idx_pi_project` | *─1 projects |

### Facturación

| Tabla | Propósito | PK | FK | Campos principales | Índices | Relaciones |
|---|---|---|---|---|---|---|
| `invoices` | Facturas emitidas al cliente | `id` | `company_id`, `client_id`, `project_id?`, `quotation_id?` | number, issue_date, due_date, status, subtotal, discount, tax, total, paid_amount, balance, ncf, ncf_type, **currency**, **exchange_rate** (tasa a base_currency vigente en issue_date) | `idx_invoices_client`, `idx_invoices_project`, `idx_invoices_status` | 1─* invoice_items, customer_payments |
| `invoice_items` | Líneas de factura | `id` | `invoice_id`, `service_id?` | description, quantity, unit_price, discount, tax, subtotal | `idx_ii_invoice` | *─1 invoices |

### Cobros

| Tabla | Propósito | PK | FK | Campos principales | Índices | Relaciones |
|---|---|---|---|---|---|---|
| `customer_payments` | Pagos recibidos de clientes | `id` | `company_id`, `client_id`, `invoice_id`, `project_id`, `bank_account_id?`, `document_id?` | payment_date, amount, method, reference, **currency**, **exchange_rate** (tasa a base_currency vigente en payment_date; puede diferir de la moneda de la factura) | `idx_cp_invoice`, `idx_cp_project` | genera `bank_transactions`; actualiza balance de `invoices` (con conversión si currency ≠ invoices.currency) |

### Gastos

| Tabla | Propósito | PK | FK | Campos principales | Índices | Relaciones |
|---|---|---|---|---|---|---|
| `expense_categories` | Categorías de gasto | `id` | `company_id` | name, description | — | 1─* expenses |
| `expenses` | Gastos de proyecto o generales | `id` | `company_id`, `category_id`, `supplier_id?`, `project_id?`, `bank_account_id?`, `document_id?` | expense_date, description, subtotal, tax, total, payment_method, status, **currency**, **exchange_rate** (tasa a base_currency vigente en expense_date) | `idx_expenses_project`, `idx_expenses_supplier` | 1─* supplier_payments (si aplica) |

### Pagos a Proveedores

| Tabla | Propósito | PK | FK | Campos principales | Índices | Relaciones |
|---|---|---|---|---|---|---|
| `supplier_payments` | Pagos realizados a proveedores (parciales o completos) | `id` | `company_id`, `supplier_id`, `expense_id?`, `project_id?`, `bank_account_id?`, `document_id?` | payment_date, amount, method, reference, **currency**, **exchange_rate** (tasa a base_currency vigente en payment_date; puede diferir de la moneda del gasto) | `idx_sp_supplier`, `idx_sp_expense` | genera `bank_transactions`; actualiza balance de `expenses` (con conversión si currency ≠ expenses.currency) |

### Bancos

| Tabla | Propósito | PK | FK | Campos principales | Índices | Relaciones |
|---|---|---|---|---|---|---|
| `bank_accounts` | Cuentas bancarias de la empresa (cada una opera en **una** moneda fija) | `id` | `company_id` | name, bank_name, account_number_masked, **currency** (ej. DOP o USD, fija por cuenta), **opening_balance**, **opening_balance_date** (saldo real al arrancar el sistema), current_balance (calculado: opening_balance + movimientos posteriores), is_active | `idx_bank_accounts_company` | 1─* bank_transactions |
| `bank_transactions` | Movimientos bancarios | `id` | `company_id`, `bank_account_id`, `project_id?`, `client_id?`, `supplier_id?`, `customer_payment_id?`, `expense_id?`, `supplier_payment_id?` | type (INCOME/EXPENSE/TRANSFER), amount, **currency** (heredada de bank_accounts.currency), **exchange_rate** (tasa a base_currency vigente en transaction_date), transaction_date, description, reconciled | `idx_bt_account`, `idx_bt_project` | trazabilidad completa hacia el origen del movimiento |

### Monedas / Tipo de Cambio

| Tabla | Propósito | PK | FK | Campos principales | Índices | Relaciones |
|---|---|---|---|---|---|---|
| `exchange_rates` | Tasas de cambio de referencia registradas por la empresa (ej. diarias) | `id` | `company_id` | currency_code, rate_to_base, effective_date, source (manual/API futura), created_by | `uq_exchange_rates_company_currency_date` | tabla de referencia; el `exchange_rate` **usado y congelado** en cada transacción vive en la propia fila (quotations, invoices, customer_payments, expenses, supplier_payments, bank_transactions), no se recalcula desde aquí después del hecho |

### Utilidades

| Tabla | Propósito | PK | FK | Campos principales | Índices | Relaciones |
|---|---|---|---|---|---|---|
| `import_batches` | Registro de cargas masivas por archivo (ej. clientes vía CSV) | `id` | `company_id`, `created_by`(profiles) | entity_type (`clients`, futuro: `suppliers`, `services`), file_name, total_rows, success_count, error_count, error_details (jsonb), status (`PROCESSING`/`COMPLETED`/`COMPLETED_WITH_ERRORS`/`FAILED`), created_at | `idx_import_batches_entity` | permite auditar y (si aplica) revertir una carga masiva; reutilizable por cualquier módulo con importación futura |

### Documentos

| Tabla | Propósito | PK | FK | Campos principales | Índices | Relaciones |
|---|---|---|---|---|---|---|
| `documents` | Metadata de archivos en Supabase Storage | `id` | `company_id` | entity_type, entity_id, file_name, storage_path, mime_type, size_bytes, uploaded_by | `idx_documents_entity` (entity_type, entity_id) | polimórfico: cotizaciones, facturas, recibos, contratos, fotos |

### Operaciones

| Tabla | Propósito | PK | FK | Campos principales | Índices | Relaciones |
|---|---|---|---|---|---|---|
| `tasks` | Tareas, opcionalmente ligadas a un proyecto | `id` | `company_id`, `project_id?`, `assigned_to`(profiles) | title, description, due_date, status, priority | `idx_tasks_project`, `idx_tasks_assigned` | *─1 projects |
| `activities` | Bitácora de actividades (llamadas, reuniones, notas) | `id` | `company_id`, `project_id?` | entity_type, entity_id, type, description, activity_date | `idx_activities_project` | polimórfico |

### Aprobaciones

| Tabla | Propósito | PK | FK | Campos principales | Índices | Relaciones |
|---|---|---|---|---|---|---|
| `approvals` | Flujo de aprobación genérico (cotizaciones, gastos, etc.) | `id` | `company_id`, `requested_by`, `approver_id`(profiles) | entity_type, entity_id, status, requested_at, resolved_at, comments | `idx_approvals_entity` | polimórfico |

### Auditoría

| Tabla | Propósito | PK | FK | Campos principales | Índices | Relaciones |
|---|---|---|---|---|---|---|
| `audit_logs` | Registro inmutable de cambios | `id` | `company_id`, `user_id`(profiles) | action, entity_type, entity_id, old_values (jsonb), new_values (jsonb), created_at, ip_address | `idx_audit_entity`, `idx_audit_created` | trazabilidad de todas las tablas críticas |

### Notificaciones

| Tabla | Propósito | PK | FK | Campos principales | Índices | Relaciones |
|---|---|---|---|---|---|---|
| `notifications` | Notificaciones internas por usuario | `id` | `company_id`, `user_id`(profiles) | type, title, message, entity_type, entity_id, is_read | `idx_notifications_user` | — |

### Configuración

| Tabla | Propósito | PK | FK | Campos principales | Índices | Relaciones |
|---|---|---|---|---|---|---|
| `settings` | Configuración clave-valor por empresa (nombre de plataforma, colores, NCF, etc.) | `id` | `company_id` | key, value (jsonb), updated_by | `uq_settings_company_key` | permite cambiar `platform_name` sin tocar código |

## H. Estrategia Supabase

- **Un solo proyecto Supabase** (`mindfreak-manager`, ya creado y verificado vacío) sirve todas las compañías (multiempresa lógica vía `company_id`, no física).
- **Migraciones versionadas** con Supabase CLI (`supabase/migrations`), nunca cambios manuales directos en producción vía dashboard salvo emergencias documentadas.
- **Seed** (`supabase/seed`) para: la compañía Mindfreak Events, los 5 roles base, el catálogo completo de permisos y su asignación por rol.
- **Funciones Postgres (`SECURITY DEFINER`)** para operaciones financieras multi-tabla (registrar cobro, registrar pago a proveedor) que deben ejecutarse atómicamente y generar auditoría.
- **Triggers** para: `updated_at` automático, y opcionalmente para disparar `audit_logs` en tablas críticas (a decidir en F4 si se hace vía trigger genérico o vía capa de aplicación — se documentará el trade-off).
- **Compartir PDF vía link**: cotizaciones y facturas generan su PDF (guardado en Storage, referenciado en `documents`) y se comparten mediante una **URL firmada de Supabase Storage con expiración** (ej. 7 días) — sin necesidad de exponer ninguna tabla de negocio públicamente ni crear una vista sin autenticación. El cliente solo ve/descarga el PDF.

## I. Auth

- Supabase Auth maneja registro (interno, no público), login, logout, recuperación de contraseña y sesiones.
- Nunca se almacenan contraseñas en tablas propias.
- `profiles` se crea automáticamente (trigger) al crearse un `auth.users`, vinculado 1:1 por `id`.
- La sesión en Next.js se maneja vía el paquete oficial de Supabase para SSR (cookies), no localStorage.

## J. Roles (V1)

`ADMIN`, `MANAGER`, `SALES`, `FINANCE`, `OPERATIONS` — según sección 8. Un usuario puede tener más de un rol. La tabla `roles` admite `company_id` nulo para roles "de plantilla" reutilizables, y no nulo para roles personalizados futuros de una empresa específica.

## K. Permisos

Modelo `ROLE → PERMISSIONS`, nunca hardcodeado por rol en el código. Catálogo inicial de permisos granulares tal como los listados en la sección 9 del prompt (clients.*, suppliers.*, quotations.*, projects.*, invoices.*, payments.*, expenses.*, banks.*, reports.view, users.manage, settings.manage), más los que surgen de esta revisión: `clients.convert` (convertir lead a cliente activo), `clients.import` (carga masiva CSV). Se ampliará por módulo a medida que se implementa cada fase (F5 en adelante).

La verificación de permisos ocurre en **tres capas**: (1) UI oculta acciones no permitidas, (2) Server Actions verifican el permiso antes de ejecutar, (3) RLS en Postgres bloquea el acceso aunque las dos capas anteriores fallen.

## L. RLS (Row Level Security)

Regla general: cada tabla de negocio tiene RLS habilitado con una policy base:

```
company_id = (SELECT company_id FROM user_roles WHERE user_id = auth.uid() LIMIT 1 ...)
```

refinada según el módulo con verificación adicional del permiso correspondiente vía una función `has_permission(permission_code)` reutilizable. El detalle de cada policy se define en F4 (Seguridad), tabla por tabla, no en F0.

## M. Auditoría

`audit_logs` registra automáticamente (vía trigger o capa de aplicación, a decidir en F4) los cambios en: facturas, pagos, gastos, cotizaciones, aprobaciones, usuarios, permisos, bancos y configuración — según sección 22. No se permite borrado físico de registros financieros; se usa `is_active` / estado / soft delete donde corresponde (nunca en `bank_transactions`, `customer_payments`, `supplier_payments`, `invoices`, `expenses`).

## N. Seguridad

- Nunca se confía solo en ocultar botones en el frontend.
- Credenciales bancarias nunca se almacenan (sección 18).
- Archivos en Storage con políticas de acceso por `company_id`.
- Variables sensibles (Supabase URL/keys) solo en variables de entorno, nunca hardcodeadas.

## O. Flujo Central

```
CLIENTE POTENCIAL (LEAD) → COTIZACIÓN → [APROBADA] → CLIENTE ACTIVO → PROYECTO/EVENTO → FACTURA → COBRO → BANCO
                                                            │ (se fija PRESUPUESTO al crear el proyecto)
                                                            │
                                                            ├─→ GASTOS → PROVEEDORES → PAGOS → BANCO
                                                            │
                                                            └─→ RENTABILIDAD (Presupuesto vs. Real, Ingresos vs. Costos)
```

Un `clients` puede crearse directamente como `status = LEAD` (cliente potencial) y recibir cotizaciones desde ese estado — no es necesario "ser cliente" para cotizarle. Cuando su primera cotización pasa a `APPROVED` (o se crea su primer proyecto, según se afine en F5), el registro se convierte a `status = ACTIVE` automáticamente o vía el botón manual "Convertir a cliente", sin duplicar el registro ni perder su historial de cotizaciones previas.

Una cotización `APPROVED` puede convertirse en `PROYECTO` sin reintroducir datos (copia de cliente, contacto, items → `project_items`). Al crear el proyecto se fija su `budget` (presupuesto), que queda disponible desde el primer momento para compararse contra los gastos reales a medida que se registran — no se calcula solo al final del evento, sino que se puede consultar en cualquier punto ("llevas 60% del presupuesto consumido y el evento aún no termina"). Un proyecto genera facturas; una factura recibe cobros; un cobro puede generar un movimiento bancario. En paralelo, un proyecto genera gastos; un gasto genera pagos a proveedor; un pago puede generar un movimiento bancario. Ambos lados alimentan la Rentabilidad del proyecto (sección P), que siempre compara lo presupuestado/estimado contra lo real.

## P. Rentabilidad

Por proyecto, calculado (no necesariamente almacenado, salvo cacheo para performance en F15). **Todo se consolida en `companies.base_currency`**, convirtiendo cada línea con el `exchange_rate` ya congelado en su propio registro (nunca con la tasa actual) — así un proyecto con facturas en USD y gastos en DOP produce una rentabilidad comparable y correcta:

- **Ingresos:** Cotizado (`quotations.total × exchange_rate`), Facturado (`invoices.total × exchange_rate` agregados), Cobrado (`customer_payments.amount × exchange_rate` agregados)
- **Costos:** Estimado (`project_items.estimated_cost` — hereda moneda/tasa del proyecto/cotización), Real (`expenses.total × exchange_rate` agregados)
- **Rentabilidad:** Utilidad estimada, Utilidad real, Margen estimado, Margen real — todo en base_currency
- **Presupuesto vs Real:** `projects.budget` (se define en base_currency) vs. gastos reales convertidos
- La UI puede mostrar adicionalmente el desglose por moneda original (ej. "USD $X + DOP $Y") como información complementaria, sin sustituir el total consolidado.

## Q. Dashboard

KPIs y gráficos (detalle de implementación en F16): ventas, cobros, gastos, pagos, cuentas por cobrar, cuentas por pagar, proyectos activos, cotizaciones pendientes/aprobadas, utilidad, margen, flujo financiero.

### Q.1 Reportes (alcance fijado para F19)

Todos con filtros por rango de fecha, cliente o proyecto, y exportación a PDF/Excel (mismo motor de PDF y librerías de la sección B):

| Reporte | Fuente de datos |
|---|---|
| Estado de cuenta por cliente (cuentas por cobrar / antigüedad de saldos) | `invoices.balance` + `customer_payments` |
| Estado de cuenta por proveedor (cuentas por pagar / antigüedad) | `expenses` + `supplier_payments` |
| Ventas por periodo / cliente / servicio | `invoices`, `invoice_items`, `services` |
| Cobros por periodo / método / banco | `customer_payments` |
| Gastos por categoría / proyecto / proveedor | `expenses`, `expense_categories` |
| Pagos a proveedores por periodo / proveedor | `supplier_payments` |
| Rentabilidad por proyecto (y consolidado de varios proyectos) | según sección P |
| Flujo de caja / movimientos bancarios por cuenta y periodo | `bank_transactions` |
| Pipeline comercial: leads vs. clientes activos, cotizaciones por estado | `clients.status`, `quotations.status` |
| Proyectos por estado (planning/confirmado/en curso/completado/cancelado) | `projects.status` |
| Auditoría (quién hizo qué, cuándo) — uso interno/Admin | `audit_logs` |

## R. V1 / V2 / V3

- **V1 (alcance de este plan de fases F1–F23):** todos los módulos listados en la sección 10, con funcionalidad completa de gestión (sin NCF/ITBIS activos en producción, solo campos preparados; sin conciliación bancaria automática; sin app móvil). Incluye generación de PDF de cotizaciones/facturas y **envío por link de descarga** (URL firmada de Storage, ver/descargar sin login).
- **V2 (backlog, no se implementa aún):** conciliación bancaria (CSV/XLSX/OFX), activación fiscal dominicana completa (NCF/ITBIS), **portal externo interactivo donde el cliente aprueba/rechaza la cotización en línea** (distinto del simple link de descarga, que sí es V1), notificaciones push/email reales.
- **V3 (backlog, largo plazo):** calendario integrado, WhatsApp, inventario, app móvil nativa, roles/permisos 100% personalizables por empresa vía UI.

## S. Riesgos

- **Multimoneda:** complejidad añadida en cobros/pagos cuando la moneda del pago difiere de la moneda de la factura/gasto (ej. factura en DOP, cobro en USD) — requiere definir con precisión en F10/F11 la regla exacta de conversión y cómo se reduce el balance pendiente. Mitigado con: tasa siempre congelada por transacción (nunca recalculada), función `has_currency_conversion()` centralizada, y tests de integración específicos para pagos cruzados de moneda.
- **Complejidad transaccional:** cobros/pagos que tocan 4-5 tablas a la vez (factura, proyecto, banco, auditoría) — mitigado con funciones Postgres transaccionales, cubiertas por tests de integración.
- **RLS mal configurado:** riesgo de fuga de datos entre compañías o de más allá de los permisos de un rol — mitigado con tests específicos de RLS por tabla en F4 y en cada fase que toque una tabla nueva.
- **Colores de marca no exactos:** el HEX del teal fue estimado visualmente del logo, no de un archivo de marca oficial — bajo riesgo, ajustable en segundos vía Design Tokens.
- **Crecimiento hacia ERP:** la tentación de añadir módulos contables/fiscales completos antes de tiempo — mitigado por la regla explícita de la sección 37 y el proceso de análisis de la sección 29 para cada nueva solicitud.

## U. UX/UI — Design System e Identidad Visual

La plataforma debe sentirse **propia de Mindfreak Events**, no un software genérico, y debe priorizar que cualquier usuario (incluso sin entrenamiento) entienda dónde está y qué puede hacer.

**Design Tokens** (centralizados, nunca color hardcodeado en un componente):

| Token | Valor | Origen |
|---|---|---|
| `brand-primary` | `#000000` | Negro del logo (texto "MINDFREAK") |
| `brand-accent` | `#17A6B8` (aprox.) | Teal del logo (barras + "EVENTS") — confirmar HEX exacto si aparece un archivo de marca oficial |
| `brand-secondary`, `brand-background`, `brand-surface`, `brand-text`, `brand-muted` | derivados en escala de grises/teal | Se definen en F1 como paleta funcional armonizada con primary/accent |
| `brand-success`, `brand-warning`, `brand-danger` | verde/ámbar/rojo estándar | Independientes de marca (semántica universal de estado) |
| `platform_name` | "Mindfreak Manager" (editable) | Vive en `settings`, nunca hardcodeado en componentes |

**Design System reutilizable** (una sola vez, consumido por todos los módulos): Button, Input, Select, Modal, Dialog, Card, Table, Badge, Tabs, Dropdown, DatePicker, **CurrencyInput** (con selector de moneda DOP/USD y símbolo correcto, dado el diseño multimoneda), Form, Alert, Toast, Pagination, Sidebar, Header, Charts. Ningún módulo inventa estilos propios.

**Principios de intuitividad** que se aplican a todo el sistema, no solo a una pantalla:

- **Feedback inmediato**: todo estado de carga, error o éxito se comunica (spinners, toasts), y toda acción financiera o destructiva pide confirmación explícita antes de ejecutarse.
- **Jerarquía visual clara**: en cada pantalla, lo más importante (total, balance pendiente, estado del proyecto/factura) se ve primero, sin scroll ni esfuerzo.
- **Consistencia total**: la misma tabla, el mismo filtro, el mismo patrón de formulario se comportan igual en Clientes, Proveedores, Cotizaciones, Facturas, etc. — quien aprende un módulo ya sabe usar los demás.
- **Multimoneda sin ambigüedad**: ningún monto se muestra "pelado"; siempre lleva su símbolo/código de moneda visible (evita confundir USD con DOP a simple vista).
- **Estados vacíos diseñados**: una lista sin datos explica qué hacer a continuación ("Aún no tienes clientes — Crear el primero"), no solo "sin resultados".
- **Responsive real**: desktop, laptop, tablet y móvil, priorizando desktop para el uso diario de oficina y tablet/móvil para consulta rápida en el evento mismo.
- **Accesibilidad**: contraste mínimo AA, navegación por teclado, labels en todos los formularios.
- **La vista de Proyecto/Evento** (con sus tabs: Resumen, Finanzas, Ingresos, Gastos, Proveedores, Facturas, Cobros, Pagos, Bancos, Tareas, Documentos, Actividades, Rentabilidad) es la pantalla que más se usará en el día a día — recibirá especial cuidado de UX cuando se implemente en F9.

Esto se define ahora como principio arquitectónico transversal; el detalle visual pixel-a-pixel de cada pantalla se trabajará módulo por módulo en su fase correspondiente (F5 en adelante), siempre reutilizando el Design System de F1.

## V. Recomendaciones

1. Confirmar el HEX exacto del teal de marca si existe un archivo de diseño oficial (no bloqueante).
2. Empezar F1–F4 (inicialización, Supabase, base de datos, seguridad) antes de cualquier módulo visible, tal como indica el plan de fases.
3. Escribir tests de RLS desde F4, no al final — es mucho más barato detectar una policy mal escrita en F4 que en F15.
4. Definir en F1 la paleta funcional completa (background/surface/muted) derivada de negro+teal, junto con el Design System base, antes de tocar cualquier módulo de negocio.
5. Mantener `PROJECT_MASTER.md`, `CHANGELOG.md` y este documento como la referencia viva del proyecto desde F1 en adelante.

## W. Backlog Inicial

| Idea | Módulo | Beneficio | Complejidad | Prioridad | Alcance |
|---|---|---|---|---|---|
| Alerta de presupuesto: notificar/mostrar cuando el gasto real de un proyecto se acerque o supere `projects.budget` (ej. 80%, 100%) | Proyectos / Rentabilidad / Notificaciones | Control financiero proactivo del evento antes de que se salga de presupuesto, sin esperar al cierre | Baja-Media (cálculo ya existe en Rentabilidad; falta el trigger/umbral y la notificación) | Media | Se revisa en F9 (Proyectos) y F15 (Rentabilidad); no bloquea V1 |

---

**Siguiente paso:** revisar esta arquitectura. Si hay ajustes, indícalos. Cuando estés de acuerdo, responde **APROBADO** para iniciar **F1 — Inicialización** (Next.js, TypeScript, Tailwind, Git) sobre el repositorio ya existente.
