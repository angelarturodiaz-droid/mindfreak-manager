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
import { Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";

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
              <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
                {group.category}
              </p>
              <div className="flex flex-col gap-0.5">
                {group.reports.map((r) => (
                  <Link
                    key={r.key}
                    href={`/reports?report=${r.key}`}
                    className={
                      activeReport === r.key
                        ? "rounded-[var(--radius-md)] bg-brand-accent-light px-2.5 py-2 text-sm font-medium text-brand-accent"
                        : "rounded-[var(--radius-md)] px-2.5 py-2 text-sm text-brand-text hover:bg-brand-surface-hover"
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
          className="rounded-[var(--radius-md)] border border-brand-border bg-brand-surface px-2 py-1.5 text-sm outline-none focus:border-brand-accent"
        />
      </div>
      <div>
        <label className="block text-xs text-brand-muted">Hasta</label>
        <input
          type="date"
          name="to"
          defaultValue={to ?? ""}
          className="rounded-[var(--radius-md)] border border-brand-border bg-brand-surface px-2 py-1.5 text-sm outline-none focus:border-brand-accent"
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
      <Button type="submit" variant="outline" size="md">
        Filtrar
      </Button>
      <Link href={`/reports?report=${report}`} className="text-sm text-brand-muted hover:underline">
        Limpiar filtros
      </Link>
    </form>
  );
}

type ProfitabilityRow = Awaited<ReturnType<typeof getProjectsProfitabilityReport>>[number];
type ReceivableRow = Awaited<ReturnType<typeof getAccountsReceivableReport>>[number];
type PayableRow = Awaited<ReturnType<typeof getAccountsPayableReport>>[number];
type SalesRow = Awaited<ReturnType<typeof getSalesByClientReport>>[number];
type ExpenseCategoryRow = Awaited<ReturnType<typeof getExpensesByCategoryReport>>[number];

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

  const columns: Column<ProfitabilityRow>[] = [
    { header: "Proyecto", accessor: (p) => `${p.number} — ${p.name}` },
    {
      header: "Estado",
      accessor: (p) => <Badge status={p.status}>{PROJECT_STATUS_LABELS[p.status] ?? p.status}</Badge>,
    },
    { header: "Cotizado", accessor: (p) => formatMoney(p.cotizado) },
    { header: "Facturado", accessor: (p) => formatMoney(p.facturado) },
    { header: "Cobrado", accessor: (p) => formatMoney(p.cobrado) },
    { header: "Costo real", accessor: (p) => formatMoney(p.costoReal) },
    {
      header: "Utilidad real",
      accessor: (p) => (
        <span className={p.utilidadReal < 0 ? "font-medium text-brand-danger" : "font-medium"}>
          {formatMoney(p.utilidadReal)}
        </span>
      ),
    },
    { header: "Margen", accessor: (p) => <span className="text-brand-muted">{formatPercent(p.margenReal)}</span> },
  ];

  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold text-brand-primary">Rentabilidad por proyecto</h2>
      <FilterBar report="rentabilidad">
        <DateRangeFields from={params.from} to={params.to} />
        <Select label="Proyecto" name="project_id" defaultValue={params.project_id ?? ""}>
          <option value="">Todos</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.number} — {p.name}
            </option>
          ))}
        </Select>
        <Select label="Cliente" name="client_id" defaultValue={params.client_id ?? ""}>
          <option value="">Todos</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select label="Estado" name="status" defaultValue={params.status ?? ""}>
          <option value="">Todos</option>
          {Object.entries(PROJECT_STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
        <Select label="Responsable" name="manager_id" defaultValue={params.manager_id ?? ""}>
          <option value="">Todos</option>
          {managers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.full_name ?? "Usuario"}
            </option>
          ))}
        </Select>
      </FilterBar>

      <DataTable
        columns={columns}
        rows={profitability}
        keyFor={(p) => p.id}
        emptyMessage="Sin proyectos que coincidan con el filtro."
        maxWidth="max-w-none"
      />
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

  const columns: Column<ReceivableRow>[] = [
    { header: "Factura", accessor: (inv) => inv.number },
    {
      header: "Cliente",
      accessor: (inv) => {
        const clientData = inv.clients as { name: string }[] | { name: string } | null;
        const clientName = Array.isArray(clientData) ? clientData[0]?.name : clientData?.name;
        return <span className="text-brand-muted">{clientName ?? "—"}</span>;
      },
    },
    { header: "Vencimiento", accessor: (inv) => <span className="text-brand-muted">{inv.due_date ?? "—"}</span> },
    {
      header: "Días vencida",
      accessor: (inv) =>
        inv.daysOverdue > 0 ? <Badge tone="danger">{inv.daysOverdue} días</Badge> : <Badge tone="success">Al día</Badge>,
    },
    { header: "Balance", accessor: (inv) => <span className="font-medium">{formatMoney(inv.balance, inv.currency)}</span> },
  ];

  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold text-brand-primary">Cuentas por cobrar</h2>
      <FilterBar report="cxc">
        <DateRangeFields from={params.from} to={params.to} />
        <Select label="Cliente" name="client_id" defaultValue={params.client_id ?? ""}>
          <option value="">Todos</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select label="Proyecto" name="project_id" defaultValue={params.project_id ?? ""}>
          <option value="">Todos</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.number} — {p.name}
            </option>
          ))}
        </Select>
        <Select label="Estado" name="status" defaultValue={params.status ?? ""}>
          <option value="">Pendiente/Parcial/Vencida</option>
          <option value="ISSUED">Emitida</option>
          <option value="PARTIALLY_PAID">Parcial</option>
          <option value="OVERDUE">Vencida</option>
          <option value="PAID">Pagada</option>
        </Select>
        <Select label="Moneda" name="currency" defaultValue={params.currency ?? ""}>
          <option value="">Todas</option>
          <option value="DOP">DOP</option>
          <option value="USD">USD</option>
        </Select>
      </FilterBar>

      <DataTable
        columns={columns}
        rows={receivable}
        keyFor={(inv) => inv.id}
        emptyMessage="No hay facturas que coincidan con el filtro."
        maxWidth="max-w-3xl"
      />
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

  const columns: Column<PayableRow>[] = [
    { header: "Gasto", accessor: (e) => e.description },
    {
      header: "Proveedor",
      accessor: (e) => {
        const supplierData = e.suppliers as { name: string }[] | { name: string } | null;
        const supplierName = Array.isArray(supplierData) ? supplierData[0]?.name : supplierData?.name;
        return <span className="text-brand-muted">{supplierName ?? "—"}</span>;
      },
    },
    { header: "Fecha", accessor: (e) => <span className="text-brand-muted">{e.expense_date}</span> },
    { header: "Balance", accessor: (e) => <span className="font-medium">{formatMoney(e.balance, e.currency)}</span> },
  ];

  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold text-brand-primary">Cuentas por pagar</h2>
      <FilterBar report="cxp">
        <DateRangeFields from={params.from} to={params.to} />
        <Select label="Proveedor" name="supplier_id" defaultValue={params.supplier_id ?? ""}>
          <option value="">Todos</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        <Select label="Proyecto" name="project_id" defaultValue={params.project_id ?? ""}>
          <option value="">Todos</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.number} — {p.name}
            </option>
          ))}
        </Select>
        <Select label="Estado" name="status" defaultValue={params.status ?? ""}>
          <option value="">Pendiente/Parcial</option>
          <option value="PENDING">Pendiente</option>
          <option value="PARTIALLY_PAID">Parcial</option>
          <option value="PAID">Pagado</option>
        </Select>
        <Select label="Moneda" name="currency" defaultValue={params.currency ?? ""}>
          <option value="">Todas</option>
          <option value="DOP">DOP</option>
          <option value="USD">USD</option>
        </Select>
      </FilterBar>

      <DataTable
        columns={columns}
        rows={payable}
        keyFor={(e) => e.id}
        emptyMessage="No hay gastos que coincidan con el filtro."
        maxWidth="max-w-3xl"
      />
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

  const columns: Column<SalesRow>[] = [
    { header: "Cliente", accessor: (c) => c.name },
    { header: "Total facturado", accessor: (c) => <span className="font-medium">{formatMoney(c.total)}</span> },
  ];

  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold text-brand-primary">Ventas por cliente</h2>
      <FilterBar report="ventas-cliente">
        <DateRangeFields from={params.from} to={params.to} />
        <Select label="Cliente" name="client_id" defaultValue={params.client_id ?? ""}>
          <option value="">Todos</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select label="Proyecto" name="project_id" defaultValue={params.project_id ?? ""}>
          <option value="">Todos</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.number} — {p.name}
            </option>
          ))}
        </Select>
        <Select label="Estado de factura" name="status" defaultValue={params.status ?? ""}>
          <option value="">Todos (sin canceladas)</option>
          {Object.entries(INVOICE_STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
        <Select label="Moneda" name="currency" defaultValue={params.currency ?? ""}>
          <option value="">Todas</option>
          <option value="DOP">DOP</option>
          <option value="USD">USD</option>
        </Select>
      </FilterBar>

      <DataTable
        columns={columns}
        rows={salesByClient}
        keyFor={(c) => c.clientId}
        emptyMessage="Sin facturación que coincida con el filtro."
        maxWidth="max-w-md"
      />
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

  const columns: Column<ExpenseCategoryRow>[] = [
    { header: "Categoría", accessor: (c) => c.name },
    { header: "Total gastado", accessor: (c) => <span className="font-medium">{formatMoney(c.total)}</span> },
  ];

  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold text-brand-primary">Gastos por categoría</h2>
      <FilterBar report="gastos-categoria">
        <DateRangeFields from={params.from} to={params.to} />
        <Select label="Categoría" name="category_id" defaultValue={params.category_id ?? ""}>
          <option value="">Todas</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select label="Proyecto" name="project_id" defaultValue={params.project_id ?? ""}>
          <option value="">Todos</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.number} — {p.name}
            </option>
          ))}
        </Select>
        <Select label="Proveedor" name="supplier_id" defaultValue={params.supplier_id ?? ""}>
          <option value="">Todos</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        <Select label="Estado" name="status" defaultValue={params.status ?? ""}>
          <option value="">Todos (sin cancelados)</option>
          {Object.entries(EXPENSE_STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
      </FilterBar>

      <DataTable
        columns={columns}
        rows={expensesByCategory}
        keyFor={(c) => c.categoryId}
        emptyMessage="Sin gastos que coincidan con el filtro."
        maxWidth="max-w-md"
      />
    </div>
  );
}
