# Snapshot de Base de Datos — Punto de Recuperación `pre-contabilidad-v1`

**Fecha**: 2026-09-18 (fecha del sistema al momento de este respaldo)
**Proyecto Supabase**: `hcospysvvwdfndihmemb`

Este archivo documenta el **estado exacto de la estructura** de la base de
datos en el momento de crear el punto de recuperación, antes de iniciar
cualquier trabajo relacionado con contabilidad de partida doble.

## Alcance real de este respaldo (léase con atención)

- ✅ **Esquema completo** (37 tablas, todas sus columnas y tipos) — capturado abajo.
- ✅ **Conteo de políticas RLS por tabla** (118 políticas en total) — capturado abajo.
- ✅ **Snapshot de conteos y totales financieros clave** — capturado abajo, sirve para verificar después que nada se movió.
- ✅ **Código fuente**: respaldado vía Git (commit + tag `pre-contabilidad-v1`, ver más abajo).
- ✅ **Migraciones**: ya están todas versionadas en `supabase/migrations/` (048 archivos), incluidas en el mismo commit de Git.
- ❌ **NO es un `pg_dump` real de los datos**: no se generó un archivo restaurable con todas las filas de todas las tablas. La herramienta usada para este respaldo (consultas SQL vía API) no tiene un mecanismo de exportación masiva de datos ni acceso de red directo al servidor de Postgres.
- ⚠️ **Backups automáticos de Supabase**: Supabase hace respaldos automáticos diarios (y Point-in-Time Recovery en planes Pro o superiores) de forma independiente a este documento. **Pendiente que el usuario confirme personalmente** en el Dashboard de Supabase → el proyecto → **Database → Backups** que estos respaldos están activos y con qué frecuencia/retención — esto no se puede verificar ni disparar desde aquí.

## Esquema completo (37 tablas)

```
activities: id uuid NOT NULL, company_id uuid NOT NULL, project_id uuid, entity_type text, entity_id uuid, type text NOT NULL, description text, activity_date timestamp with time zone NOT NULL, created_by uuid, created_at timestamp with time zone NOT NULL, updated_at timestamp with time zone NOT NULL

approvals: id uuid NOT NULL, company_id uuid NOT NULL, entity_type text NOT NULL, entity_id uuid NOT NULL, requested_by uuid, approver_id uuid, status text NOT NULL, requested_at timestamp with time zone NOT NULL, resolved_at timestamp with time zone, comments text, created_at timestamp with time zone NOT NULL, updated_at timestamp with time zone NOT NULL

audit_logs: id uuid NOT NULL, company_id uuid NOT NULL, user_id uuid, action text NOT NULL, entity_type text NOT NULL, entity_id uuid NOT NULL, old_values jsonb, new_values jsonb, ip_address text, created_at timestamp with time zone NOT NULL

bank_account_balances (vista): bank_account_id uuid, current_balance numeric

bank_accounts: id uuid NOT NULL, company_id uuid NOT NULL, name text NOT NULL, bank_name text, account_number_masked text, currency text NOT NULL, opening_balance numeric NOT NULL, opening_balance_date date NOT NULL, is_active boolean NOT NULL, created_at timestamp with time zone NOT NULL, updated_at timestamp with time zone NOT NULL, type text NOT NULL, credit_limit numeric

bank_catalog: id uuid NOT NULL, company_id uuid NOT NULL, name text NOT NULL, is_active boolean NOT NULL, created_at timestamp with time zone NOT NULL, updated_at timestamp with time zone NOT NULL

bank_transactions: id uuid NOT NULL, company_id uuid NOT NULL, bank_account_id uuid NOT NULL, project_id uuid, client_id uuid, supplier_id uuid, customer_payment_id uuid, expense_id uuid, supplier_payment_id uuid, type text NOT NULL, amount numeric NOT NULL, currency text NOT NULL, exchange_rate numeric NOT NULL, transaction_date date NOT NULL, description text, reconciled boolean NOT NULL, created_at timestamp with time zone NOT NULL, updated_at timestamp with time zone NOT NULL

client_contacts: id uuid NOT NULL, client_id uuid NOT NULL, company_id uuid NOT NULL, full_name text NOT NULL, position text, email text, phone text, is_primary boolean NOT NULL, created_at timestamp with time zone NOT NULL, updated_at timestamp with time zone NOT NULL

clients: id uuid NOT NULL, company_id uuid NOT NULL, name text NOT NULL, tax_id text, email text, phone text, address text, status text NOT NULL, is_active boolean NOT NULL, created_by uuid, created_at timestamp with time zone NOT NULL, updated_at timestamp with time zone NOT NULL

companies: id uuid NOT NULL, name text NOT NULL, legal_name text, tax_id text, platform_name text NOT NULL, logo_url text, brand_primary text, brand_accent text, base_currency text NOT NULL, is_active boolean NOT NULL, created_at timestamp with time zone NOT NULL, updated_at timestamp with time zone NOT NULL, address text, phone text, email text

customer_payments: id uuid NOT NULL, company_id uuid NOT NULL, client_id uuid NOT NULL, invoice_id uuid NOT NULL, project_id uuid, bank_account_id uuid, document_id uuid, payment_date date NOT NULL, amount numeric NOT NULL, method text NOT NULL, reference text, currency text NOT NULL, exchange_rate numeric NOT NULL, notes text, created_by uuid, created_at timestamp with time zone NOT NULL, updated_at timestamp with time zone NOT NULL

dashboard_widget_preferences: id uuid NOT NULL, user_id uuid NOT NULL, company_id uuid NOT NULL, widgets jsonb NOT NULL, updated_at timestamp with time zone NOT NULL

documents: id uuid NOT NULL, company_id uuid NOT NULL, entity_type text NOT NULL, entity_id uuid NOT NULL, file_name text NOT NULL, storage_path text NOT NULL, mime_type text, size_bytes bigint, uploaded_by uuid, created_at timestamp with time zone NOT NULL, updated_at timestamp with time zone NOT NULL

exchange_rates: id uuid NOT NULL, company_id uuid NOT NULL, currency_code text NOT NULL, rate_to_base numeric NOT NULL, effective_date date NOT NULL, source text NOT NULL, created_by uuid, created_at timestamp with time zone NOT NULL

expense_categories: id uuid NOT NULL, company_id uuid NOT NULL, name text NOT NULL, description text, created_at timestamp with time zone NOT NULL, updated_at timestamp with time zone NOT NULL

expenses: id uuid NOT NULL, company_id uuid NOT NULL, category_id uuid, supplier_id uuid, project_id uuid, bank_account_id uuid, document_id uuid, expense_date date NOT NULL, description text NOT NULL, subtotal numeric NOT NULL, tax numeric NOT NULL, total numeric NOT NULL, paid_amount numeric NOT NULL, balance numeric NOT NULL, payment_method text, status text NOT NULL, currency text NOT NULL, exchange_rate numeric NOT NULL, created_by uuid, created_at timestamp with time zone NOT NULL, updated_at timestamp with time zone NOT NULL, payee_bank_name text

import_batches: id uuid NOT NULL, company_id uuid NOT NULL, entity_type text NOT NULL, file_name text NOT NULL, total_rows integer NOT NULL, success_count integer NOT NULL, error_count integer NOT NULL, error_details jsonb, status text NOT NULL, created_by uuid, created_at timestamp with time zone NOT NULL, updated_at timestamp with time zone NOT NULL

invoice_collection_history: id uuid NOT NULL, company_id uuid NOT NULL, invoice_id uuid NOT NULL, user_id uuid NOT NULL, action_date date NOT NULL, action text NOT NULL, comment text, result text, next_action_date date, created_at timestamp with time zone NOT NULL

invoice_items: id uuid NOT NULL, invoice_id uuid NOT NULL, service_id uuid, description text NOT NULL, quantity numeric NOT NULL, unit_price numeric NOT NULL, discount numeric NOT NULL, tax numeric NOT NULL, subtotal numeric NOT NULL, sort_order integer NOT NULL, created_at timestamp with time zone NOT NULL, updated_at timestamp with time zone NOT NULL, tax_rate_id uuid

invoices: id uuid NOT NULL, company_id uuid NOT NULL, client_id uuid NOT NULL, project_id uuid, quotation_id uuid, number text NOT NULL, issue_date date NOT NULL, due_date date, status text NOT NULL, subtotal numeric NOT NULL, discount numeric NOT NULL, tax numeric NOT NULL, total numeric NOT NULL, paid_amount numeric NOT NULL, balance numeric NOT NULL, ncf text, ncf_type text, currency text NOT NULL, exchange_rate numeric NOT NULL, created_by uuid, created_at timestamp with time zone NOT NULL, updated_at timestamp with time zone NOT NULL, payment_terms_id uuid, credit_days integer, responsible_user_id uuid, commission_percent numeric NOT NULL, commission_amount numeric NOT NULL, billing_type text NOT NULL, e_ncf text, e_ncf_valid_until date, payment_type_code text, security_code text, digital_signature_at timestamp with time zone

notifications: id uuid NOT NULL, company_id uuid NOT NULL, user_id uuid NOT NULL, type text NOT NULL, title text NOT NULL, message text, entity_type text, entity_id uuid, is_read boolean NOT NULL, created_at timestamp with time zone NOT NULL, updated_at timestamp with time zone NOT NULL

payment_terms: id uuid NOT NULL, company_id uuid NOT NULL, name text NOT NULL, credit_days integer NOT NULL, payment_method text NOT NULL, advance_percent numeric NOT NULL, balance_percent numeric NOT NULL, is_active boolean NOT NULL, created_at timestamp with time zone NOT NULL, updated_at timestamp with time zone NOT NULL

permissions: id uuid NOT NULL, code text NOT NULL, module text NOT NULL, description text, created_at timestamp with time zone NOT NULL

profiles: id uuid NOT NULL, full_name text, email text, phone text, avatar_url text, is_active boolean NOT NULL, created_at timestamp with time zone NOT NULL, updated_at timestamp with time zone NOT NULL, position text

project_items: id uuid NOT NULL, project_id uuid NOT NULL, service_id uuid, description text NOT NULL, quantity numeric NOT NULL, unit_price numeric NOT NULL, estimated_cost numeric NOT NULL, subtotal numeric NOT NULL, sort_order integer NOT NULL, created_at timestamp with time zone NOT NULL, updated_at timestamp with time zone NOT NULL

projects: id uuid NOT NULL, company_id uuid NOT NULL, client_id uuid NOT NULL, contact_id uuid, quotation_id uuid, manager_id uuid, number text NOT NULL, name text NOT NULL, event_date date, event_time time without time zone, location_name text, address text, status text NOT NULL, budget numeric NOT NULL, notes text, created_by uuid, created_at timestamp with time zone NOT NULL, updated_at timestamp with time zone NOT NULL

quotation_items: id uuid NOT NULL, quotation_id uuid NOT NULL, service_id uuid, description text NOT NULL, quantity numeric NOT NULL, unit_price numeric NOT NULL, discount numeric NOT NULL, tax numeric NOT NULL, subtotal numeric NOT NULL, estimated_unit_cost numeric NOT NULL, sort_order integer NOT NULL, created_at timestamp with time zone NOT NULL, updated_at timestamp with time zone NOT NULL, tax_rate_id uuid

quotations: id uuid NOT NULL, company_id uuid NOT NULL, client_id uuid NOT NULL, contact_id uuid, project_id uuid, number text NOT NULL, issue_date date NOT NULL, valid_until date, status text NOT NULL, subtotal numeric NOT NULL, discount numeric NOT NULL, tax numeric NOT NULL, total numeric NOT NULL, estimated_cost numeric NOT NULL, estimated_margin numeric, terms text, currency text NOT NULL, exchange_rate numeric NOT NULL, created_by uuid, approved_by uuid, approved_at timestamp with time zone, created_at timestamp with time zone NOT NULL, updated_at timestamp with time zone NOT NULL, payment_terms_id uuid, credit_days integer, payment_method text, advance_percent numeric, balance_percent numeric, commission_percent numeric NOT NULL, commission_amount numeric NOT NULL

role_permissions: role_id uuid NOT NULL, permission_id uuid NOT NULL, created_at timestamp with time zone NOT NULL

roles: id uuid NOT NULL, company_id uuid, name text NOT NULL, description text, is_system boolean NOT NULL, created_at timestamp with time zone NOT NULL, updated_at timestamp with time zone NOT NULL

service_categories: id uuid NOT NULL, company_id uuid NOT NULL, name text NOT NULL, description text, created_at timestamp with time zone NOT NULL, updated_at timestamp with time zone NOT NULL

services: id uuid NOT NULL, company_id uuid NOT NULL, category_id uuid, name text NOT NULL, unit text, default_price numeric NOT NULL, default_cost numeric NOT NULL, is_active boolean NOT NULL, created_at timestamp with time zone NOT NULL, updated_at timestamp with time zone NOT NULL, type text NOT NULL, description text, default_tax_percent numeric NOT NULL

settings: id uuid NOT NULL, company_id uuid NOT NULL, key text NOT NULL, value jsonb NOT NULL, updated_by uuid, created_at timestamp with time zone NOT NULL, updated_at timestamp with time zone NOT NULL

supplier_contacts: id uuid NOT NULL, supplier_id uuid NOT NULL, company_id uuid NOT NULL, full_name text NOT NULL, position text, email text, phone text, is_primary boolean NOT NULL, created_at timestamp with time zone NOT NULL, updated_at timestamp with time zone NOT NULL

supplier_payments: id uuid NOT NULL, company_id uuid NOT NULL, supplier_id uuid NOT NULL, expense_id uuid, project_id uuid, bank_account_id uuid, document_id uuid, payment_date date NOT NULL, amount numeric NOT NULL, method text NOT NULL, reference text, currency text NOT NULL, exchange_rate numeric NOT NULL, notes text, created_by uuid, created_at timestamp with time zone NOT NULL, updated_at timestamp with time zone NOT NULL, payee_bank_name text

suppliers: id uuid NOT NULL, company_id uuid NOT NULL, name text NOT NULL, tax_id text, category text, email text, phone text, address text, is_active boolean NOT NULL, created_by uuid, created_at timestamp with time zone NOT NULL, updated_at timestamp with time zone NOT NULL

tasks: id uuid NOT NULL, company_id uuid NOT NULL, project_id uuid, assigned_to uuid, title text NOT NULL, description text, due_date date, status text NOT NULL, priority text NOT NULL, created_by uuid, created_at timestamp with time zone NOT NULL, updated_at timestamp with time zone NOT NULL

tax_rates: id uuid NOT NULL, company_id uuid NOT NULL, name text NOT NULL, rate numeric NOT NULL, is_default boolean NOT NULL, is_active boolean NOT NULL, created_at timestamp with time zone NOT NULL, updated_at timestamp with time zone NOT NULL

user_roles: user_id uuid NOT NULL, role_id uuid NOT NULL, company_id uuid NOT NULL, created_at timestamp with time zone NOT NULL
```

## Funciones de negocio (5, todas `SECURITY DEFINER`)

Toda la lógica de movimiento de dinero del sistema pasa por estas 5
funciones — no está dispersa en la aplicación:

- `register_customer_payment(...)` — cobro de factura → actualiza factura + genera movimiento bancario.
- `register_supplier_payment(...)` — pago a proveedor → actualiza gasto + genera movimiento bancario.
- `create_bank_transfer(...)` — transferencia entre cuentas propias.
- `create_card_expense(...)` — gasto pagado con tarjeta (nace ya pagado).
- `generate_due_date_alerts()` — alertas de vencimiento (vía pg_cron diario).

Definiciones completas disponibles en `supabase/migrations/` (versionadas
en Git, ver commit/tag de este mismo respaldo).

## Políticas RLS: 118 en total, distribuidas en 37 tablas

(Conteo por tabla disponible en el historial de este chat — todas las
tablas de negocio tienen entre 2 y 4 políticas: select/insert/update/
delete según corresponda. Las tablas financieras críticas
—`bank_transactions`, `customer_payments`, `supplier_payments`,
`expenses`— NO tienen política de DELETE: no se pueden borrar bajo
ninguna circunstancia desde la aplicación.)

## Snapshot financiero de verificación (para comparar antes/después)

| Tabla/métrica | Valor al momento de este respaldo |
|---|---|
| clients | 5 |
| suppliers | 2 |
| quotations | 5 |
| quotations — suma de `total` | 1,238.00 |
| quotation_items | 2 |
| quotation_items — suma de `tax` | 198.00 |
| invoices | 7 |
| invoices — suma de `total` | 29,273.00 |
| invoices — suma de `tax` | 4,473.00 |
| invoices — suma de `balance` | 23,432.00 |
| invoice_items | 6 |
| invoice_items — suma de `tax` | 3,789.00 |
| expenses | 0 |
| customer_payments | 3 |
| customer_payments — suma de `amount` | 5,841.00 |
| supplier_payments | 0 |
| bank_transactions | 2 |
| bank_accounts | 1 |
| projects | 3 |
| tax_rates | 2 |

**Uso de esta tabla**: si en algún momento se sospecha que un cambio
alteró datos financieros existentes, se puede volver a correr las mismas
consultas y comparar contra estos valores.
