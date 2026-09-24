import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowDownCircle, AlertTriangle, Clock, CalendarClock, CalendarDays, CalendarRange } from "lucide-react";
import { hasPermission } from "@/lib/auth/permissions";
import {
  getProjectsProfitabilityReport,
  getAccountsReceivableReport,
  getAccountsPayableReport,
  getSalesByClientReport,
  getExpensesByCategoryReport,
  getReceivablesDashboard,
  getCashflowByCategoryReport,
  listBankAccountsForFilter,
  listClientsForFilter,
  listSuppliersForFilter,
  listProjectsForFilter,
  listExpenseCategoriesForFilter,
  listManagersForFilter,
} from "@/features/reports/queries";
import { Select, FIELD_CLASSES } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Chip, InitialsAvatar, SectionHeader, StatCard } from "@/components/ui/page-kit";
import { relationName } from "@/lib/utils/relation";
import { formatDate, pluralDays } from "@/lib/utils/dates";
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
  {
    category: "Cobros",
    reports: [
      { key: "vencimientos", label: "Cuentas por Cobrar y Vencimientos" },
      { key: "cxc", label: "Cuentas por cobrar (detalle)" },
    ],
  },
  { category: "Pagos", reports: [{ key: "cxp", label: "Cuentas por pagar" }] },
  {
    category: "Bancos",
    reports: [{ key: "flujo-categoria", label: "Ingresos y egresos por categoría" }],
  },
  { category: "Ventas", reports: [{ key: "ventas-cliente", label: "Ventas por cliente" }] },
  { category: "Gastos", reports: [{ key: "gastos-categoria", label: "Gastos por categoría" }] },
];

const DEFAULT_REPORT = "vencimientos";

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
  bank_account_id?: string;
  include_transfers?: string;
  view?: string;
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
    <main className="flex flex-1 flex-col gap-6 p-4 md:flex-row md:gap-8 md:p-8">
      <aside className="w-full shrink-0 md:sticky md:top-4 md:w-60 md:self-start">
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
        {activeReport === "vencimientos" && <ReceivablesDashboardReport />}
        {activeReport === "cxc" && <ReceivableReport params={params} />}
        {activeReport === "cxp" && <PayableReport params={params} />}
        {activeReport === "ventas-cliente" && <SalesByClientReport params={params} />}
        {activeReport === "flujo-categoria" && <CashflowByCategoryReport params={params} />}
        {activeReport === "gastos-categoria" && <ExpensesByCategoryReport params={params} />}
      </section>
    </main>
  );
}

function ClientCell({ rel }: { rel: unknown }) {
  const name = relationName(rel);
  if (!name) return <span className="text-brand-muted">—</span>;
  return (
    <span className="flex items-center gap-2">
      <InitialsAvatar name={name} size="sm" />
      <span className="text-brand-text">{name}</span>
    </span>
  );
}

function Money({ value, currency, strong, tone }: { value: number; currency?: string; strong?: boolean; tone?: "danger" | "warning" }) {
  const color = tone === "danger" ? "text-brand-danger" : tone === "warning" ? "text-brand-warning" : "";
  return (
    <span className={`whitespace-nowrap tabular-nums ${strong ? "font-medium" : ""} ${color}`}>
      {formatMoney(value, currency)}
    </span>
  );
}

/** Barra horizontal de participación (% del total) para reportes agrupados. */
function ShareBar({ value, total }: { value: number; total: number }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="flex min-w-[8rem] items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-brand-surface-hover">
        <div className="h-full rounded-full bg-brand-accent" style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className="w-10 text-right text-xs tabular-nums text-brand-muted">{pct.toFixed(0)}%</span>
    </div>
  );
}

function ReportTitle({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-xl font-semibold text-brand-primary">{title}</h2>
      {description && <p className="text-sm text-brand-muted">{description}</p>}
    </div>
  );
}

function DateRangeFields({ from, to }: { from?: string; to?: string }) {
  return (
    <>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-brand-text">Desde</label>
        <input type="date" name="from" defaultValue={from ?? ""} className={FIELD_CLASSES} />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-brand-text">Hasta</label>
        <input type="date" name="to" defaultValue={to ?? ""} className={FIELD_CLASSES} />
      </div>
    </>
  );
}

function FilterBar({ report, children }: { report: string; children: React.ReactNode }) {
  return (
    <Card className="mb-5">
      <form action="/reports" method="get" className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="report" value={report} />
        {children}
        <Button type="submit" variant="primary" size="md">
          Aplicar filtros
        </Button>
        <Link href={`/reports?report=${report}`} className="py-2 text-sm text-brand-muted hover:text-brand-accent hover:underline">
          Limpiar
        </Link>
      </form>
    </Card>
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
    {
      header: "Proyecto",
      accessor: (p) => (
        <Link href={`/projects/${p.id}`} className="group block min-w-[10rem]">
          <span className="block font-medium text-brand-text group-hover:text-brand-accent">{p.name}</span>
          <span className="text-xs text-brand-muted">{p.number}</span>
        </Link>
      ),
    },
    {
      header: "Estado",
      accessor: (p) => <Badge status={p.status}>{PROJECT_STATUS_LABELS[p.status] ?? p.status}</Badge>,
    },
    { header: "Cotizado", className: "text-right", accessor: (p) => <Money value={p.cotizado} /> },
    { header: "Facturado", className: "text-right", accessor: (p) => <Money value={p.facturado} /> },
    { header: "Cobrado", className: "text-right", accessor: (p) => <Money value={p.cobrado} /> },
    { header: "Costo real", className: "text-right", accessor: (p) => <Money value={p.costoReal} /> },
    {
      header: "Utilidad real",
      className: "text-right",
      accessor: (p) => <Money value={p.utilidadReal} strong tone={p.utilidadReal < 0 ? "danger" : undefined} />,
    },
    {
      header: "Margen",
      className: "text-right",
      accessor: (p) =>
        p.margenReal === null ? (
          <span className="text-brand-muted">—</span>
        ) : (
          <span className="inline-flex justify-end">
            <Chip tone={p.margenReal < 0 ? "danger" : p.margenReal < 20 ? "warning" : "success"}>
              {formatPercent(p.margenReal)}
            </Chip>
          </span>
        ),
    },
  ];

  return (
    <div>
      <ReportTitle
        title="Rentabilidad por proyecto"
        description="Cotizado, facturado, cobrado y costo real de cada proyecto, con su utilidad y margen."
      />
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

      {profitability.length > 0 && (
        <section className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Facturado" value={formatMoney(profitability.reduce((a, p) => a + p.facturado, 0))} icon={<ArrowDownCircle size={20} />} tone="blue" hint={`${profitability.length} proyectos`} />
          <StatCard label="Cobrado" value={formatMoney(profitability.reduce((a, p) => a + p.cobrado, 0))} icon={<CalendarDays size={20} />} tone="green" />
          <StatCard label="Costo real" value={formatMoney(profitability.reduce((a, p) => a + p.costoReal, 0))} icon={<Clock size={20} />} tone="amber" />
          <StatCard
            label="Utilidad real"
            value={formatMoney(profitability.reduce((a, p) => a + p.utilidadReal, 0))}
            valueTone={profitability.reduce((a, p) => a + p.utilidadReal, 0) < 0 ? "danger" : "success"}
            icon={<CalendarRange size={20} />}
            tone="violet"
          />
        </section>
      )}
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

async function ReceivablesDashboardReport() {
  const data = await getReceivablesDashboard();

  const overdueColumns: Column<(typeof data.facturasVencidas)[number]>[] = [
    {
      header: "Factura",
      accessor: (inv) => (
        <Link href={`/invoices/${inv.id}`} className="font-medium text-brand-text hover:text-brand-accent">
          {inv.number}
        </Link>
      ),
    },
    { header: "Cliente", accessor: (inv) => <ClientCell rel={inv.clients} /> },
    { header: "Vencimiento", accessor: (inv) => <span className="whitespace-nowrap text-brand-muted">{formatDate(inv.due_date)}</span> },
    { header: "Atraso", accessor: (inv) => <Chip tone="danger">Vencida hace {pluralDays(inv.daysOverdue)}</Chip> },
    { header: "Balance", className: "text-right", accessor: (inv) => <Money value={inv.balance} currency={inv.currency} strong tone="danger" /> },
  ];

  const upcomingColumns: Column<(typeof data.facturasProximasAVencer)[number]>[] = [
    {
      header: "Factura",
      accessor: (inv) => (
        <Link href={`/invoices/${inv.id}`} className="font-medium text-brand-text hover:text-brand-accent">
          {inv.number}
        </Link>
      ),
    },
    { header: "Cliente", accessor: (inv) => <ClientCell rel={inv.clients} /> },
    { header: "Vencimiento", accessor: (inv) => <span className="whitespace-nowrap text-brand-muted">{formatDate(inv.due_date)}</span> },
    {
      header: "Vence",
      accessor: (inv) =>
        inv.daysUntilDue === 0 ? (
          <Chip tone="warning">Hoy</Chip>
        ) : inv.daysUntilDue === 1 ? (
          <Chip tone="warning">Mañana</Chip>
        ) : (
          <Chip tone={(inv.daysUntilDue ?? 99) <= 7 ? "warning" : "muted"}>En {pluralDays(inv.daysUntilDue ?? 0)}</Chip>
        ),
    },
    { header: "Balance", className: "text-right", accessor: (inv) => <Money value={inv.balance} currency={inv.currency} strong /> },
  ];

  const pendingQuoteColumns: Column<(typeof data.cotizacionesPendientes)[number]>[] = [
    {
      header: "Cotización",
      accessor: (q) => (
        <Link href={`/quotations/${q.id}`} className="font-medium text-brand-text hover:text-brand-accent">
          {q.number}
        </Link>
      ),
    },
    { header: "Cliente", accessor: (q) => <ClientCell rel={q.clients} /> },
    { header: "Válida hasta", accessor: (q) => <span className="whitespace-nowrap text-brand-muted">{formatDate(q.valid_until)}</span> },
    { header: "Total", className: "text-right", accessor: (q) => <Money value={q.total} currency={q.currency} strong /> },
  ];

  const acceptedColumns: Column<(typeof data.cotizacionesAceptadasSinFacturar)[number]>[] = [
    {
      header: "Cotización",
      accessor: (q) => (
        <Link href={`/quotations/${q.id}`} className="font-medium text-brand-text hover:text-brand-accent">
          {q.number}
        </Link>
      ),
    },
    { header: "Cliente", accessor: (q) => <ClientCell rel={q.clients} /> },
    { header: "Total", className: "text-right", accessor: (q) => <Money value={q.total} currency={q.currency} strong /> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <ReportTitle
        title="Cuentas por Cobrar y Vencimientos"
        description="Consolidado en la moneda base, en vivo — no es un corte histórico."
      />

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          label="Total por cobrar"
          value={formatMoney(data.totalPorCobrar)}
          hint="Balance de todas las facturas abiertas"
          icon={<ArrowDownCircle size={20} />}
          tone="blue"
        />
        <StatCard
          label="Total vencido"
          value={formatMoney(data.totalVencido)}
          valueTone={data.totalVencido > 0 ? "danger" : "success"}
          hint={`${data.facturasVencidas.length} ${data.facturasVencidas.length === 1 ? "factura vencida" : "facturas vencidas"}`}
          icon={<AlertTriangle size={20} />}
          tone="red"
        />
        <StatCard
          label="Vence hoy"
          value={formatMoney(data.totalVenceHoy)}
          valueTone={data.totalVenceHoy > 0 ? "warning" : undefined}
          hint={data.totalVenceHoy > 0 ? "Dar seguimiento hoy" : "Nada vence hoy"}
          icon={<Clock size={20} />}
          tone="amber"
        />
      </section>

      <Card>
        <p className="mb-3 text-sm font-semibold text-brand-text">Lo que vence próximamente</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { label: "Próximos 7 días", value: data.totalProximos7, icon: <CalendarClock size={16} /> },
            { label: "Próximos 15 días", value: data.totalProximos15, icon: <CalendarDays size={16} /> },
            { label: "Próximos 30 días", value: data.totalProximos30, icon: <CalendarRange size={16} /> },
          ].map((h) => {
            const pct = data.totalProximos30 > 0 ? (h.value / data.totalProximos30) * 100 : 0;
            return (
              <div key={h.label} className="flex flex-col gap-1.5">
                <p className="flex items-center gap-1.5 text-sm text-brand-muted">
                  {h.icon} {h.label}
                </p>
                <p className="break-words text-lg font-semibold tabular-nums text-brand-text">{formatMoney(h.value)}</p>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-brand-surface-hover">
                  <div className="h-full rounded-full bg-brand-accent" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-brand-muted">Los rangos son acumulados: 30 días incluye lo de 7 y 15.</p>
      </Card>

      <section>
        <SectionHeader title="Calendario de vencimientos" description="Próximos 30 días, agrupado por fecha." />
        <ReceivablesTimeline invoices={data.facturasProximasAVencer} />
      </section>

      <section>
        <SectionHeader title="Facturas vencidas" count={data.facturasVencidas.length} />
        <DataTable
          columns={overdueColumns}
          rows={data.facturasVencidas}
          keyFor={(inv) => inv.id}
          maxWidth="max-w-none"
          emptyMessage="Sin facturas vencidas. 🎉"
        />
      </section>

      <section>
        <SectionHeader title="Facturas próximas a vencer" count={data.facturasProximasAVencer.length} description="Próximos 30 días." />
        <DataTable
          columns={upcomingColumns}
          rows={data.facturasProximasAVencer}
          keyFor={(inv) => inv.id}
          maxWidth="max-w-none"
          emptyMessage="Sin facturas próximas a vencer."
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="min-w-0">
          <SectionHeader title="Cotizaciones pendientes de aceptación" count={data.cotizacionesPendientes.length} />
          <DataTable
            columns={pendingQuoteColumns}
            rows={data.cotizacionesPendientes}
            keyFor={(q) => q.id}
            maxWidth="max-w-none"
            emptyMessage="Sin cotizaciones pendientes."
          />
        </section>
        <section className="min-w-0">
          <SectionHeader title="Aceptadas, pendientes de facturar" count={data.cotizacionesAceptadasSinFacturar.length} />
          <DataTable
            columns={acceptedColumns}
            rows={data.cotizacionesAceptadasSinFacturar}
            keyFor={(q) => q.id}
            maxWidth="max-w-none"
            emptyMessage="Sin pendientes."
          />
        </section>
      </div>
    </div>
  );
}

function ReceivablesTimeline({
  invoices,
}: {
  invoices: { id: string; number: string; due_date: string | null; balance: number; currency: string; daysUntilDue: number | null }[];
}) {
  if (invoices.length === 0) {
    return <p className="text-sm text-brand-muted">Sin vencimientos en los próximos 30 días.</p>;
  }

  const byDate = new Map<string, typeof invoices>();
  for (const inv of invoices) {
    const key = inv.due_date ?? "—";
    const list = byDate.get(key) ?? [];
    list.push(inv);
    byDate.set(key, list);
  }
  const sortedDates = Array.from(byDate.keys()).sort();

  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      {sortedDates.map((date) => {
        const dayInvoices = byDate.get(date) ?? [];
        const dayTotal = dayInvoices.reduce((acc, i) => acc + i.balance, 0);
        const days = dayInvoices[0]?.daysUntilDue ?? null;
        const soon = days !== null && days <= 7;
        return (
          <div
            key={date}
            className={`flex w-44 shrink-0 flex-col gap-1 rounded-[var(--radius-lg)] border p-4 ${
              days === 0
                ? "border-brand-danger/40 bg-brand-danger-bg"
                : soon
                  ? "border-brand-warning/40 bg-brand-warning-bg"
                  : "border-brand-border bg-brand-surface"
            }`}
          >
            <p className="text-xs font-medium uppercase tracking-wide text-brand-muted">
              {days === 0 ? "Hoy" : days === 1 ? "Mañana" : days !== null ? `En ${pluralDays(days)}` : ""}
            </p>
            <p className="text-sm font-semibold text-brand-text">{date === "—" ? "Sin fecha" : formatDate(date)}</p>
            <p className="mt-1 text-base font-semibold tabular-nums text-brand-text">
              {formatMoney(dayTotal, dayInvoices[0]?.currency)}
            </p>
            <p className="text-xs text-brand-muted">
              {dayInvoices.length === 1 ? dayInvoices[0].number : `${dayInvoices.length} facturas`}
            </p>
          </div>
        );
      })}
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
    {
      header: "Factura",
      accessor: (inv) => (
        <Link href={`/invoices/${inv.id}`} className="font-medium text-brand-text hover:text-brand-accent">
          {inv.number}
        </Link>
      ),
    },
    { header: "Cliente", accessor: (inv) => <ClientCell rel={inv.clients} /> },
    { header: "Vencimiento", accessor: (inv) => <span className="whitespace-nowrap text-brand-muted">{formatDate(inv.due_date)}</span> },
    {
      header: "Situación",
      accessor: (inv) =>
        inv.daysOverdue > 0 ? (
          <Chip tone="danger">Vencida hace {pluralDays(inv.daysOverdue)}</Chip>
        ) : (
          <Chip tone="success">Al día</Chip>
        ),
    },
    {
      header: "Balance",
      className: "text-right",
      accessor: (inv) => <Money value={inv.balance} currency={inv.currency} strong tone={inv.daysOverdue > 0 ? "danger" : undefined} />,
    },
  ];

  return (
    <div>
      <ReportTitle title="Cuentas por cobrar" description="Detalle de facturas con balance, filtrable por cliente, proyecto, estado y moneda." />
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
        maxWidth="max-w-none"
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
    {
      header: "Gasto",
      accessor: (e) => (
        <Link href={`/expenses/${e.id}`} className="font-medium text-brand-text hover:text-brand-accent">
          {e.description}
        </Link>
      ),
    },
    { header: "Proveedor", accessor: (e) => <ClientCell rel={e.suppliers} /> },
    { header: "Fecha", accessor: (e) => <span className="whitespace-nowrap text-brand-muted">{formatDate(e.expense_date)}</span> },
    { header: "Balance", className: "text-right", accessor: (e) => <Money value={e.balance} currency={e.currency} strong tone="warning" /> },
  ];

  return (
    <div>
      <ReportTitle title="Cuentas por pagar" description="Gastos con saldo pendiente con proveedores." />
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
        maxWidth="max-w-none"
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

  const salesTotal = salesByClient.reduce((a, c) => a + c.total, 0);
  const columns: Column<SalesRow>[] = [
    {
      header: "Cliente",
      accessor: (c) => (
        <span className="flex items-center gap-2">
          <InitialsAvatar name={c.name} size="sm" />
          <span className="text-brand-text">{c.name}</span>
        </span>
      ),
    },
    { header: "Participación", accessor: (c) => <ShareBar value={c.total} total={salesTotal} /> },
    { header: "Total facturado", className: "text-right", accessor: (c) => <Money value={c.total} strong /> },
  ];

  return (
    <div>
      <ReportTitle title="Ventas por cliente" description="Total facturado por cliente en la moneda base, de mayor a menor." />
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
        maxWidth="max-w-3xl"
      />
      {salesByClient.length > 0 && (
        <p className="mt-3 max-w-3xl text-right text-sm text-brand-muted">
          Total: <span className="font-semibold tabular-nums text-brand-text">{formatMoney(salesTotal)}</span>
        </p>
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

  const expensesTotal = expensesByCategory.reduce((a, c) => a + c.total, 0);
  const columns: Column<ExpenseCategoryRow>[] = [
    { header: "Categoría", accessor: (c) => <span className="font-medium text-brand-text">{c.name}</span> },
    { header: "Participación", accessor: (c) => <ShareBar value={c.total} total={expensesTotal} /> },
    { header: "Total gastado", className: "text-right", accessor: (c) => <Money value={c.total} strong /> },
  ];

  return (
    <div>
      <ReportTitle title="Gastos por categoría" description="Total gastado por categoría en la moneda base, de mayor a menor." />
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
        maxWidth="max-w-3xl"
      />
      {expensesByCategory.length > 0 && (
        <p className="mt-3 max-w-3xl text-right text-sm text-brand-muted">
          Total: <span className="font-semibold tabular-nums text-brand-text">{formatMoney(expensesTotal)}</span>
        </p>
      )}
    </div>
  );
}

function monthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Intl.DateTimeFormat("es-DO", { month: "short", year: "2-digit", timeZone: "UTC" })
    .format(new Date(Date.UTC(y, m - 1, 1)))
    .replace(" de ", " ");
}

async function CashflowByCategoryReport({ params }: { params: Params }) {
  const includeTransfers = params.include_transfers === "1";
  const monthly = params.view === "mensual";
  const [report, accounts, projects] = await Promise.all([
    getCashflowByCategoryReport({
      from: params.from,
      to: params.to,
      bankAccountId: params.bank_account_id,
      projectId: params.project_id,
      includeTransfers,
    }),
    listBankAccountsForFilter(),
    listProjectsForFilter(),
  ]);
  type Row = (typeof report.rows)[number];
  const volume = report.rows.reduce((a, r) => a + r.ingresos + r.egresos, 0);

  const viewHref = (view?: string) => {
    const qs = new URLSearchParams();
    qs.set("report", "flujo-categoria");
    for (const k of ["from", "to", "bank_account_id", "project_id", "include_transfers"] as const) {
      const v = params[k];
      if (v) qs.set(k, v);
    }
    if (view) qs.set("view", view);
    return `/reports?${qs.toString()}`;
  };

  const categoryCell = (r: Row) =>
    r.categoryId === "sin-categoria" ? (
      <span className="inline-flex items-center gap-1.5 font-medium text-brand-warning">
        <AlertTriangle size={14} /> Sin categoría
      </span>
    ) : (
      <span className="font-medium text-brand-text">{r.name}</span>
    );

  const summaryColumns: Column<Row>[] = [
    { header: "Categoría", accessor: categoryCell },
    { header: "Mov.", className: "text-right", accessor: (r) => <span className="tabular-nums text-brand-muted">{r.count}</span> },
    {
      header: "Ingresos",
      className: "text-right",
      accessor: (r) =>
        r.ingresos > 0 ? <span className="whitespace-nowrap tabular-nums text-brand-success">{formatMoney(r.ingresos)}</span> : <span className="text-brand-muted">—</span>,
    },
    {
      header: "Egresos",
      className: "text-right",
      accessor: (r) =>
        r.egresos > 0 ? <span className="whitespace-nowrap tabular-nums text-brand-danger">{formatMoney(r.egresos)}</span> : <span className="text-brand-muted">—</span>,
    },
    {
      header: "Neto",
      className: "text-right",
      accessor: (r) => <Money value={r.neto} strong tone={r.neto < 0 ? "danger" : undefined} />,
    },
    { header: "Peso", accessor: (r) => <ShareBar value={r.ingresos + r.egresos} total={volume} /> },
  ];

  return (
    <div>
      <ReportTitle
        title="Ingresos y egresos por categoría"
        description="Flujo real de los movimientos de banco, agrupado por categoría y en la moneda base."
      />
      <FilterBar report="flujo-categoria">
        {monthly && <input type="hidden" name="view" value="mensual" />}
        <DateRangeFields from={params.from} to={params.to} />
        <Select label="Cuenta" name="bank_account_id" defaultValue={params.bank_account_id ?? ""}>
          <option value="">Todas</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.currency})
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
        <label className="flex items-center gap-2 pb-2 text-sm text-brand-text">
          <input type="checkbox" name="include_transfers" value="1" defaultChecked={includeTransfers} />
          Incluir transferencias entre cuentas
        </label>
      </FilterBar>

      <section className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Ingresos" value={formatMoney(report.totals.ingresos)} valueTone="success" icon={<ArrowDownCircle size={20} />} tone="green" />
        <StatCard label="Egresos" value={formatMoney(report.totals.egresos)} valueTone="danger" icon={<CalendarClock size={20} />} tone="red" />
        <StatCard
          label="Neto"
          value={formatMoney(report.totals.neto)}
          valueTone={report.totals.neto < 0 ? "danger" : "success"}
          hint="Ingresos − egresos"
          icon={<CalendarRange size={20} />}
          tone="blue"
        />
        <StatCard
          label="Sin categoría"
          value={String(report.uncategorized.count)}
          valueTone={report.uncategorized.count > 0 ? "warning" : "success"}
          hint={report.uncategorized.count > 0 ? `${formatMoney(report.uncategorized.amount)} por clasificar` : "Todo clasificado"}
          icon={<AlertTriangle size={20} />}
          tone="amber"
        />
      </section>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Vista" className="flex gap-1.5">
          {[
            { key: undefined, label: "Resumen" },
            { key: "mensual", label: "Por mes" },
          ].map((v) => {
            const active = (v.key === "mensual") === monthly;
            return (
              <Link
                key={v.label}
                href={viewHref(v.key)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                  active
                    ? "border-brand-primary bg-brand-primary text-white"
                    : "border-brand-border bg-brand-surface text-brand-muted hover:bg-brand-surface-hover hover:text-brand-text"
                }`}
              >
                {v.label}
              </Link>
            );
          })}
        </nav>
        <p className="text-xs text-brand-muted">
          {includeTransfers
            ? "Incluye transferencias entre cuentas propias."
            : "Sin transferencias entre cuentas propias (no son ingreso ni gasto)."}
        </p>
      </div>

      {report.rows.length === 0 ? (
        <p className="rounded-[var(--radius-lg)] border border-dashed border-brand-border p-6 text-center text-sm text-brand-muted">
          Sin movimientos que coincidan con el filtro.
        </p>
      ) : !monthly ? (
        <>
          <DataTable columns={summaryColumns} rows={report.rows} keyFor={(r) => r.categoryId} maxWidth="max-w-none" />
          <div className="mt-3 flex flex-wrap justify-end gap-6 text-sm text-brand-muted">
            <span>
              Ingresos <span className="font-semibold tabular-nums text-brand-success">{formatMoney(report.totals.ingresos)}</span>
            </span>
            <span>
              Egresos <span className="font-semibold tabular-nums text-brand-danger">{formatMoney(report.totals.egresos)}</span>
            </span>
            <span>
              Neto <span className="font-semibold tabular-nums text-brand-text">{formatMoney(report.totals.neto)}</span>
            </span>
          </div>
        </>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-brand-border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-brand-border bg-brand-background text-left text-xs font-medium uppercase tracking-wide text-brand-muted">
                <th className="sticky left-0 bg-brand-background px-4 py-3">Categoría</th>
                {report.months.map((m) => (
                  <th key={m} className="whitespace-nowrap px-4 py-3 text-right">
                    {monthLabel(m)}
                  </th>
                ))}
                <th className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((r) => (
                <tr key={r.categoryId} className="border-b border-brand-border/60 bg-brand-surface last:border-0 hover:bg-brand-surface-hover">
                  <td className="sticky left-0 bg-inherit px-4 py-3">{categoryCell(r)}</td>
                  {report.months.map((m) => {
                    const v = r.byMonth[m] ?? 0;
                    return (
                      <td
                        key={m}
                        className={`whitespace-nowrap px-4 py-3 text-right tabular-nums ${
                          v === 0 ? "text-brand-muted" : v < 0 ? "text-brand-danger" : "text-brand-success"
                        }`}
                      >
                        {v === 0 ? "—" : formatMoney(v)}
                      </td>
                    );
                  })}
                  <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums">{formatMoney(r.neto)}</td>
                </tr>
              ))}
              <tr className="bg-brand-background font-semibold">
                <td className="sticky left-0 bg-brand-background px-4 py-3">Neto del mes</td>
                {report.months.map((m) => {
                  const v = report.rows.reduce((a, r) => a + (r.byMonth[m] ?? 0), 0);
                  return (
                    <td key={m} className={`whitespace-nowrap px-4 py-3 text-right tabular-nums ${v < 0 ? "text-brand-danger" : "text-brand-text"}`}>
                      {formatMoney(v)}
                    </td>
                  );
                })}
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{formatMoney(report.totals.neto)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-brand-muted">
        Los valores positivos son ingresos netos y los negativos, egresos netos. Montos consolidados con la
        tasa guardada en cada movimiento.
      </p>
    </div>
  );
}
