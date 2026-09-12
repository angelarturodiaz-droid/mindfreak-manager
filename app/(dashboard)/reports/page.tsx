import Link from "next/link";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/auth/permissions";
import {
  getProjectsProfitabilityReport,
  getAccountsReceivableReport,
  getAccountsPayableReport,
  getSalesByClientReport,
  getExpensesByCategoryReport,
  listClientsForFilter,
  listSuppliersForFilter,
  listProjectsForFilter,
  listExpenseCategoriesForFilter,
  listManagersForFilter,
} from "@/features/reports/queries";

function formatMoney(amount: number, currency = "DOP") {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency }).format(amount);
}

function formatPercent(value: number | null) {
  if (value === null) return "—";
  return `${value.toFixed(1)}%`;
}

const PROJECT_STATUS_LABELS: Record<string, string> = {
  PLANNING: "Planificación",
  CONFIRMED: "Confirmado",
  IN_PROGRESS: "En curso",
  COMPLETED: "Completado",
  CANCELLED: "Cancelado",
};

const INVOICE_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  ISSUED: "Emitida",
  PARTIALLY_PAID: "Parcial",
  PAID: "Pagada",
  OVERDUE: "Vencida",
  CANCELLED: "Cancelada",
};

const EXPENSE_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  PARTIALLY_PAID: "Parcial",
  PAID: "Pagado",
  CANCELLED: "Cancelado",
};

const REPORT_CATALOG: { category: string; reports: { key: string; label: string }[] }[] = [
  { category: "Proyectos", reports: [{ key: "rentabilidad", label: "Rentabilidad por proyecto" }] },
  { category: "Cobros", reports: [{ key: "cxc", label: "Cuentas por cobrar" }] },
  { category: "Pagos", reports: [{ key: "cxp", label: "Cuentas por pagar" }] },
  { category: "Ventas", reports: [{ key: "ventas-cliente", label: "Ventas por cliente" }] },
  { category: "Gastos", reports: [{ key: "gastos-categoria", label: "Gastos por categoría" }] },
];

const DEFAULT_REPORT = "rentabilidad";

type Params = {
  report?: string;
  from?: string;
  to?: string;
  project_id?: string;
  client_id?: string;
  supplier_id?: string;
  category_id?: string;
  manager_id?: string;
  status?: string;
  currency?: string;
};

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  if (!(await hasPermission("reports.view"))) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const activeReport = params.report ?? DEFAULT_REPORT;

  return (
    <main className="flex flex-1 gap-8 p-8">
      <aside className="w-64 shrink-0">
        <h1 className="mb-1 text-xl font-semibold text-brand-primary">Reportes</h1>
        <p className="mb-4 text-xs text-brand-muted">
          Vistas de solo lectura, consolidadas en la moneda base.
        </p>
        <nav className="flex flex-col gap-4">
          {REPORT_CATALOG.map((group) => (
            <div key={group.category}>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-brand-muted">
                {group.category}
              </p>
              <div className="flex flex-col">
                {group.reports.map((r) => (
                  <Link
                    key={r.key}
                    href={`/reports?report=${r.key}`}
                    className={
                      activeReport === r.key
                        ? "border-l-2 border-brand-accent bg-brand-accent/10 px-2 py-1.5 text-sm font-medium text-brand-accent"
                        : "border-l-2 border-transparent px-2 py-1.5 text-sm text-brand-text hover:text-brand-accent"
                    }
                  >
                    {r.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <section className="min-w-0 flex-1">
        {activeReport === "rentabilidad" && <ProfitabilityReport params={params} />}
        {activeReport === "cxc" && <ReceivableReport params={params} />}
        {activeReport === "cxp" && <PayableReport params={params} />}
        {activeReport === "ventas-cliente" && <SalesByClientReport params={params} />}
        {activeReport === "gastos-categoria" && <ExpensesByCategoryReport params={params} />}
      </section>
    </main>
  );
}

function DateRangeFields({ from, to }: { from?: string; to?: string }) {
  return (
    <>
      <div>
        <label className="block text-xs text-brand-muted">Desde</label>
        <input
          type="date"
          name="from"
          defaultValue={from ?? ""}
          className="border border-brand-muted/30 bg-brand-surface px-2 py-1.5 text-sm outline-none focus:border-brand-accent"
        />
      </div>
      <div>
        <label className="block text-xs text-brand-muted">Hasta</label>
        <input
          type="date"
          name="to"
          defaultValue={to ?? ""}
          className="border border-brand-muted/30 bg-brand-surface px-2 py-1.5 text-sm outline-none focus:border-brand-accent"
        />
      </div>
    </>
  );
}

function FilterBar({ report, children }: { report: string; children: React.ReactNode }) {
  return (
    <form action="/reports" method="get" className="mb-4 flex flex-wrap items-end gap-3">
      <input type="hidden" name="report" value={report} />
      {children}
      <button
        type="submit"
        className="border border-brand-muted/30 px-4 py-2 text-sm text-brand-text hover:border-brand-accent"
      >
        Filtrar
      </button>
      <Link href={`/reports?report=${report}`} className="text-sm text-brand-muted hover:underline">
        Limpiar
      </Link>
    </form>
  );
}

async function ProfitabilityReport({ params }: { params: Params }) {
  const [profitability, clients, projects, managers] = await Promise.all([
    getProjectsProfitabilityReport({
      from: params.from,
      to: params.to,
      projectId: params.project_id,
      clientId: params.client_id,
      status: params.status,
      managerId: params.manager_id,
    }),
    listClientsForFilter(),
    listProjectsForFilter(),
    listManagersForFilter(),
  ]);

  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold text-brand-primary">Rentabilidad por proyecto</h2>
      <FilterBar report="rentabilidad">
        <DateRangeFields from={params.from} to={params.to} />
        <div>
          <label className="block text-xs text-brand-muted">Proyecto</label>
          <select
            name="project_id"
            defaultValue={params.project_id ?? ""}
            className="border border-brand-muted/30 bg-brand-surface px-2 py-1.5 text-sm outline-none focus:border-brand-accent"
          >
            <option value="">Todos</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.number} — {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-brand-muted">Cliente</label>
          <select
            name="client_id"
            defaultValue={params.client_id ?? ""}
            className="border border-brand-muted/30 bg-brand-surface px-2 py-1.5 text-sm outline-none focus:border-brand-accent"
          >
            <option value="">Todos</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-brand-muted">Estado</label>
          <select
            name="status"
            defaultValue={params.status ?? ""}
            className="border border-brand-muted/30 bg-brand-surface px-2 py-1.5 text-sm outline-none focus:border-brand-accent"
          >
            <option value="">Todos</option>
            {Object.entries(PROJECT_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-brand-muted">Responsable</label>
          <select
            name="manager_id"
            defaultValue={params.manager_id ?? ""}
            className="border border-brand-muted/30 bg-brand-surface px-2 py-1.5 text-sm outline-none focus:border-brand-accent"
          >
            <option value="">Todos</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.full_name ?? "Usuario"}
              </option>
            ))}
          </select>
        </div>
      </FilterBar>

      {profitability.length === 0 ? (
        <p className="text-sm text-brand-muted">Sin proyectos que coincidan con el filtro.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-brand-muted/30 text-left text-brand-muted">
                <th className="py-2 pr-4 font-medium">Proyecto</th>
                <th className="py-2 pr-4 font-medium">Estado</th>
                <th className="py-2 pr-4 font-medium">Cotizado</th>
                <th className="py-2 pr-4 font-medium">Facturado</th>
                <th className="py-2 pr-4 font-medium">Cobrado</th>
                <th className="py-2 pr-4 font-medium">Costo real</th>
                <th className="py-2 pr-4 font-medium">Utilidad real</th>
                <th className="py-2 font-medium">Margen</th>
              </tr>
            </thead>
            <tbody>
              {profitability.map((p) => (
                <tr key={p.id} className="border-b border-brand-muted/10">
                  <td className="py-2 pr-4">
                    {p.number} — {p.name}
                  </td>
                  <td className="py-2 pr-4 text-brand-muted">
                    {PROJECT_STATUS_LABELS[p.status] ?? p.status}
                  </td>
                  <td className="py-2 pr-4">{formatMoney(p.cotizado)}</td>
                  <td className="py-2 pr-4">{formatMoney(p.facturado)}</td>
                  <td className="py-2 pr-4">{formatMoney(p.cobrado)}</td>
                  <td className="py-2 pr-4">{formatMoney(p.costoReal)}</td>
                  <td
                    className={
                      p.utilidadReal < 0
                        ? "py-2 pr-4 font-medium text-brand-danger"
                        : "py-2 pr-4 font-medium"
                    }
                  >
                    {formatMoney(p.utilidadReal)}
                  </td>
                  <td className="py-2 text-brand-muted">{formatPercent(p.margenReal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

async function ReceivableReport({ params }: { params: Params }) {
  const [receivable, clients, projects] = await Promise.all([
    getAccountsReceivableReport({
      from: params.from,
      to: params.to,
      clientId: params.client_id,
      status: params.status,
      projectId: params.project_id,
      currency: params.currency,
    }),
    listClientsForFilter(),
    listProjectsForFilter(),
  ]);

  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold text-brand-primary">Cuentas por cobrar</h2>
      <FilterBar report="cxc">
        <DateRangeFields from={params.from} to={params.to} />
        <div>
          <label className="block text-xs text-brand-muted">Cliente</label>
          <select
            name="client_id"
            defaultValue={params.client_id ?? ""}
            className="border border-brand-muted/30 bg-brand-surface px-2 py-1.5 text-sm outline-none focus:border-brand-accent"
          >
            <option value="">Todos</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-brand-muted">Proyecto</label>
          <select
            name="project_id"
            defaultValue={params.project_id ?? ""}
            className="border border-brand-muted/30 bg-brand-surface px-2 py-1.5 text-sm outline-none focus:border-brand-accent"
          >
            <option value="">Todos</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.number} — {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-brand-muted">Estado</label>
          <select
            name="status"
            defaultValue={params.status ?? ""}
            className="border border-brand-muted/30 bg-brand-surface px-2 py-1.5 text-sm outline-none focus:border-brand-accent"
          >
            <option value="">Pendiente/Parcial/Vencida</option>
            <option value="ISSUED">Emitida</option>
            <option value="PARTIALLY_PAID">Parcial</option>
            <option value="OVERDUE">Vencida</option>
            <option value="PAID">Pagada</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-brand-muted">Moneda</label>
          <select
            name="currency"
            defaultValue={params.currency ?? ""}
            className="border border-brand-muted/30 bg-brand-surface px-2 py-1.5 text-sm outline-none focus:border-brand-accent"
          >
            <option value="">Todas</option>
            <option value="DOP">DOP</option>
            <option value="USD">USD</option>
          </select>
        </div>
      </FilterBar>

      {receivable.length === 0 ? (
        <p className="text-sm text-brand-muted">No hay facturas que coincidan con el filtro.</p>
      ) : (
        <table className="w-full max-w-3xl border-collapse text-sm">
          <thead>
            <tr className="border-b border-brand-muted/30 text-left text-brand-muted">
              <th className="py-2 pr-4 font-medium">Factura</th>
              <th className="py-2 pr-4 font-medium">Cliente</th>
              <th className="py-2 pr-4 font-medium">Vencimiento</th>
              <th className="py-2 pr-4 font-medium">Días vencida</th>
              <th className="py-2 font-medium">Balance</th>
            </tr>
          </thead>
          <tbody>
            {receivable.map((inv) => {
              const clientData = inv.clients as { name: string }[] | { name: string } | null;
              const clientName = Array.isArray(clientData) ? clientData[0]?.name : clientData?.name;
              return (
                <tr key={inv.id} className="border-b border-brand-muted/10">
                  <td className="py-2 pr-4">{inv.number}</td>
                  <td className="py-2 pr-4 text-brand-muted">{clientName ?? "—"}</td>
                  <td className="py-2 pr-4 text-brand-muted">{inv.due_date ?? "—"}</td>
                  <td className="py-2 pr-4">
                    {inv.daysOverdue > 0 ? (
                      <span className="text-brand-danger">{inv.daysOverdue} días</span>
                    ) : (
                      "Al día"
                    )}
                  </td>
                  <td className="py-2 font-medium">{formatMoney(inv.balance, inv.currency)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

async function PayableReport({ params }: { params: Params }) {
  const [payable, suppliers, projects] = await Promise.all([
    getAccountsPayableReport({
      from: params.from,
      to: params.to,
      supplierId: params.supplier_id,
      status: params.status,
      projectId: params.project_id,
      currency: params.currency,
    }),
    listSuppliersForFilter(),
    listProjectsForFilter(),
  ]);

  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold text-brand-primary">Cuentas por pagar</h2>
      <FilterBar report="cxp">
        <DateRangeFields from={params.from} to={params.to} />
        <div>
          <label className="block text-xs text-brand-muted">Proveedor</label>
          <select
            name="supplier_id"
            defaultValue={params.supplier_id ?? ""}
            className="border border-brand-muted/30 bg-brand-surface px-2 py-1.5 text-sm outline-none focus:border-brand-accent"
          >
            <option value="">Todos</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-brand-muted">Proyecto</label>
          <select
            name="project_id"
            defaultValue={params.project_id ?? ""}
            className="border border-brand-muted/30 bg-brand-surface px-2 py-1.5 text-sm outline-none focus:border-brand-accent"
          >
            <option value="">Todos</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.number} — {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-brand-muted">Estado</label>
          <select
            name="status"
            defaultValue={params.status ?? ""}
            className="border border-brand-muted/30 bg-brand-surface px-2 py-1.5 text-sm outline-none focus:border-brand-accent"
          >
            <option value="">Pendiente/Parcial</option>
            <option value="PENDING">Pendiente</option>
            <option value="PARTIALLY_PAID">Parcial</option>
            <option value="PAID">Pagado</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-brand-muted">Moneda</label>
          <select
            name="currency"
            defaultValue={params.currency ?? ""}
            className="border border-brand-muted/30 bg-brand-surface px-2 py-1.5 text-sm outline-none focus:border-brand-accent"
          >
            <option value="">Todas</option>
            <option value="DOP">DOP</option>
            <option value="USD">USD</option>
          </select>
        </div>
      </FilterBar>

      {payable.length === 0 ? (
        <p className="text-sm text-brand-muted">No hay gastos que coincidan con el filtro.</p>
      ) : (
        <table className="w-full max-w-3xl border-collapse text-sm">
          <thead>
            <tr className="border-b border-brand-muted/30 text-left text-brand-muted">
              <th className="py-2 pr-4 font-medium">Gasto</th>
              <th className="py-2 pr-4 font-medium">Proveedor</th>
              <th className="py-2 pr-4 font-medium">Fecha</th>
              <th className="py-2 font-medium">Balance</th>
            </tr>
          </thead>
          <tbody>
            {payable.map((e) => {
              const supplierData = e.suppliers as { name: string }[] | { name: string } | null;
              const supplierName = Array.isArray(supplierData)
                ? supplierData[0]?.name
                : supplierData?.name;
              return (
                <tr key={e.id} className="border-b border-brand-muted/10">
                  <td className="py-2 pr-4">{e.description}</td>
                  <td className="py-2 pr-4 text-brand-muted">{supplierName ?? "—"}</td>
                  <td className="py-2 pr-4 text-brand-muted">{e.expense_date}</td>
                  <td className="py-2 font-medium">{formatMoney(e.balance, e.currency)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

async function SalesByClientReport({ params }: { params: Params }) {
  const [salesByClient, clients, projects] = await Promise.all([
    getSalesByClientReport({
      from: params.from,
      to: params.to,
      clientId: params.client_id,
      projectId: params.project_id,
      status: params.status,
      currency: params.currency,
    }),
    listClientsForFilter(),
    listProjectsForFilter(),
  ]);

  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold text-brand-primary">Ventas por cliente</h2>
      <FilterBar report="ventas-cliente">
        <DateRangeFields from={params.from} to={params.to} />
        <div>
          <label className="block text-xs text-brand-muted">Cliente</label>
          <select
            name="client_id"
            defaultValue={params.client_id ?? ""}
            className="border border-brand-muted/30 bg-brand-surface px-2 py-1.5 text-sm outline-none focus:border-brand-accent"
          >
            <option value="">Todos</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-brand-muted">Proyecto</label>
          <select
            name="project_id"
            defaultValue={params.project_id ?? ""}
            className="border border-brand-muted/30 bg-brand-surface px-2 py-1.5 text-sm outline-none focus:border-brand-accent"
          >
            <option value="">Todos</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.number} — {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-brand-muted">Estado de factura</label>
          <select
            name="status"
            defaultValue={params.status ?? ""}
            className="border border-brand-muted/30 bg-brand-surface px-2 py-1.5 text-sm outline-none focus:border-brand-accent"
          >
            <option value="">Todos (sin canceladas)</option>
            {Object.entries(INVOICE_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-brand-muted">Moneda</label>
          <select
            name="currency"
            defaultValue={params.currency ?? ""}
            className="border border-brand-muted/30 bg-brand-surface px-2 py-1.5 text-sm outline-none focus:border-brand-accent"
          >
            <option value="">Todas</option>
            <option value="DOP">DOP</option>
            <option value="USD">USD</option>
          </select>
        </div>
      </FilterBar>

      {salesByClient.length === 0 ? (
        <p className="text-sm text-brand-muted">Sin facturación que coincida con el filtro.</p>
      ) : (
        <table className="w-full max-w-md border-collapse text-sm">
          <thead>
            <tr className="border-b border-brand-muted/30 text-left text-brand-muted">
              <th className="py-2 pr-4 font-medium">Cliente</th>
              <th className="py-2 font-medium">Total facturado</th>
            </tr>
          </thead>
          <tbody>
            {salesByClient.map((c) => (
              <tr key={c.clientId} className="border-b border-brand-muted/10">
                <td className="py-2 pr-4">{c.name}</td>
                <td className="py-2 font-medium">{formatMoney(c.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

async function ExpensesByCategoryReport({ params }: { params: Params }) {
  const [expensesByCategory, categories, projects, suppliers] = await Promise.all([
    getExpensesByCategoryReport({
      from: params.from,
      to: params.to,
      categoryId: params.category_id,
      projectId: params.project_id,
      supplierId: params.supplier_id,
      status: params.status,
    }),
    listExpenseCategoriesForFilter(),
    listProjectsForFilter(),
    listSuppliersForFilter(),
  ]);

  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold text-brand-primary">Gastos por categoría</h2>
      <FilterBar report="gastos-categoria">
        <DateRangeFields from={params.from} to={params.to} />
        <div>
          <label className="block text-xs text-brand-muted">Categoría</label>
          <select
            name="category_id"
            defaultValue={params.category_id ?? ""}
            className="border border-brand-muted/30 bg-brand-surface px-2 py-1.5 text-sm outline-none focus:border-brand-accent"
          >
            <option value="">Todas</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-brand-muted">Proyecto</label>
          <select
            name="project_id"
            defaultValue={params.project_id ?? ""}
            className="border border-brand-muted/30 bg-brand-surface px-2 py-1.5 text-sm outline-none focus:border-brand-accent"
          >
            <option value="">Todos</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.number} — {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-brand-muted">Proveedor</label>
          <select
            name="supplier_id"
            defaultValue={params.supplier_id ?? ""}
            className="border border-brand-muted/30 bg-brand-surface px-2 py-1.5 text-sm outline-none focus:border-brand-accent"
          >
            <option value="">Todos</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-brand-muted">Estado</label>
          <select
            name="status"
            defaultValue={params.status ?? ""}
            className="border border-brand-muted/30 bg-brand-surface px-2 py-1.5 text-sm outline-none focus:border-brand-accent"
          >
            <option value="">Todos (sin cancelados)</option>
            {Object.entries(EXPENSE_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </FilterBar>

      {expensesByCategory.length === 0 ? (
        <p className="text-sm text-brand-muted">Sin gastos que coincidan con el filtro.</p>
      ) : (
        <table className="w-full max-w-md border-collapse text-sm">
          <thead>
            <tr className="border-b border-brand-muted/30 text-left text-brand-muted">
              <th className="py-2 pr-4 font-medium">Categoría</th>
              <th className="py-2 font-medium">Total gastado</th>
            </tr>
          </thead>
          <tbody>
            {expensesByCategory.map((c) => (
              <tr key={c.categoryId} className="border-b border-brand-muted/10">
                <td className="py-2 pr-4">{c.name}</td>
                <td className="py-2 font-medium">{formatMoney(c.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
