import Link from "next/link";
import { redirect } from "next/navigation";
import {
  TrendingUp,
  ArrowLeftRight,
  Users,
  Award,
  CalendarRange,
  Wallet,
  CreditCard,
  ArrowDownCircle,
  AlertTriangle,
  CalendarClock,
} from "lucide-react";
import { hasPermission } from "@/lib/auth/permissions";
import { resolvePeriod, type Period } from "@/features/comparisons/period";
import {
  getProjectProfitabilityComparison,
  getReceivablesVsPayables,
  getSalesByClientComparison,
  getClientProfitabilityComparison,
  getPeriodOverPeriodComparison,
} from "@/features/comparisons/queries";
import { KpiCard } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PeriodBar } from "./period-bar";
import { DeltaPill } from "./delta-pill";
import { ComparisonBarChart } from "./comparison-bar-chart";

function formatMoney(amount: number, currency = "DOP") {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}
function formatMoneyPrecise(amount: number, currency = "DOP") {
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

const TABS: { key: string; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { key: "rentabilidad-proyecto", label: "Rentabilidad por proyecto", icon: TrendingUp },
  { key: "cxc-cxp", label: "CxC vs. CxP", icon: ArrowLeftRight },
  { key: "ventas-cliente", label: "Ventas por cliente", icon: Users },
  { key: "rentabilidad-cliente", label: "Rentabilidad por cliente", icon: Award },
  { key: "periodo-vs-periodo", label: "Período vs. período", icon: CalendarRange },
];

const DEFAULT_TAB = "rentabilidad-proyecto";

type Params = { tab?: string; period?: string; from?: string; to?: string };

export default async function ComparisonsPage({ searchParams }: { searchParams: Promise<Params> }) {
  if (!(await hasPermission("reports.view"))) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const activeTab = TABS.some((t) => t.key === params.tab) ? (params.tab as string) : DEFAULT_TAB;
  const period = resolvePeriod(params);

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-8">
      <div>
        <h1 className="text-xl font-semibold text-brand-primary">Comparaciones</h1>
        <p className="text-sm text-brand-muted">
          Los indicadores más importantes para la gestión financiera y comercial, período contra período.
        </p>
      </div>

      <nav className="flex flex-wrap gap-1.5 border-b border-brand-border pb-3">
        {TABS.map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.key;
          return (
            <Link
              key={t.key}
              href={`/comparisons?tab=${t.key}&period=${period.key}${period.key === "custom" ? `&from=${period.from}&to=${period.to}` : ""}`}
              className={
                isActive
                  ? "flex items-center gap-1.5 rounded-[var(--radius-md)] bg-brand-accent-light px-3 py-2 text-sm font-medium text-brand-accent"
                  : "flex items-center gap-1.5 rounded-[var(--radius-md)] px-3 py-2 text-sm text-brand-muted hover:bg-brand-surface-hover hover:text-brand-text"
              }
            >
              <Icon size={15} />
              {t.label}
            </Link>
          );
        })}
      </nav>

      <PeriodBar tab={activeTab} period={period} />

      {activeTab === "rentabilidad-proyecto" && <ProjectProfitabilityTab period={period} />}
      {activeTab === "cxc-cxp" && <ReceivablesVsPayablesTab period={period} />}
      {activeTab === "ventas-cliente" && <SalesByClientTab period={period} />}
      {activeTab === "rentabilidad-cliente" && <ClientProfitabilityTab period={period} />}
      {activeTab === "periodo-vs-periodo" && <PeriodOverPeriodTab period={period} />}
    </main>
  );
}

// ---------------------------------------------------------------------------
// 1. Rentabilidad por proyecto
// ---------------------------------------------------------------------------

async function ProjectProfitabilityTab({ period }: { period: Period }) {
  const { rows, totals } = await getProjectProfitabilityComparison(period);
  const top = rows.slice(0, 8);

  const columns: Column<(typeof rows)[number]>[] = [
    { header: "Proyecto", accessor: (p) => `${p.number} — ${p.name}` },
    { header: "Estado", accessor: (p) => <Badge status={p.status}>{PROJECT_STATUS_LABELS[p.status] ?? p.status}</Badge> },
    { header: "Ingresos", accessor: (p) => formatMoneyPrecise(p.ingresos) },
    { header: "Gastos", accessor: (p) => formatMoneyPrecise(p.gastos) },
    {
      header: "Utilidad",
      accessor: (p) => (
        <span className={p.utilidad < 0 ? "font-medium text-brand-danger" : "font-medium"}>{formatMoneyPrecise(p.utilidad)}</span>
      ),
    },
    { header: "Margen", accessor: (p) => <span className="text-brand-muted">{formatPercent(p.margen)}</span> },
    { header: "vs. período anterior", accessor: (p) => <DeltaPill pct={p.deltaUtilidadPct} /> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <KpiCard
          label="Ingresos"
          value={formatMoney(totals.ingresos)}
          trend={totals.deltaIngresosPct !== null ? `${totals.deltaIngresosPct >= 0 ? "+" : ""}${totals.deltaIngresosPct.toFixed(1)}%` : undefined}
          icon={<TrendingUp size={16} />}
        />
        <KpiCard
          label="Gastos"
          value={formatMoney(totals.gastos)}
          trend={totals.deltaGastosPct !== null ? `${totals.deltaGastosPct >= 0 ? "+" : ""}${totals.deltaGastosPct.toFixed(1)}%` : undefined}
          icon={<CreditCard size={16} />}
        />
        <KpiCard
          label="Utilidad"
          value={formatMoney(totals.utilidad)}
          danger={totals.utilidad < 0}
          trend={totals.deltaUtilidadPct !== null ? `${totals.deltaUtilidadPct >= 0 ? "+" : ""}${totals.deltaUtilidadPct.toFixed(1)}%` : undefined}
          icon={<Award size={16} />}
        />
      </section>

      {top.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-medium text-brand-text">Ingresos vs. gastos por proyecto (top {top.length})</h3>
          <div className="rounded-[var(--radius-lg)] border border-brand-border bg-brand-surface p-4">
            <ComparisonBarChart
              data={top.map((p) => ({ name: p.number, Ingresos: Math.round(p.ingresos), Gastos: Math.round(p.gastos) }))}
              xKey="name"
              bars={[
                { key: "Ingresos", name: "Ingresos", color: "var(--chart-1)" },
                { key: "Gastos", name: "Gastos", color: "var(--chart-4)" },
              ]}
            />
          </div>
        </section>
      )}

      <section>
        <h3 className="mb-2 text-sm font-medium text-brand-text">Detalle por proyecto ({rows.length})</h3>
        <DataTable
          columns={columns}
          rows={rows}
          keyFor={(p) => p.id}
          maxWidth="max-w-none"
          emptyMessage="Sin proyectos con evento en este período."
        />
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. CxC vs. CxP
// ---------------------------------------------------------------------------

async function ReceivablesVsPayablesTab({ period }: { period: Period }) {
  const { cxc, cxp } = await getReceivablesVsPayables(period);

  const overdueColumns: Column<(typeof cxc.facturasVencidas)[number]>[] = [
    { header: "Factura", accessor: (inv) => inv.number },
    { header: "Cliente", accessor: (inv) => <span className="text-brand-muted">{inv.clientName ?? "—"}</span> },
    { header: "Vencimiento", accessor: (inv) => inv.due_date },
    { header: "Balance", accessor: (inv) => <span className="font-medium">{formatMoneyPrecise(inv.balance, inv.currency)}</span> },
  ];

  const payableColumns: Column<(typeof cxp.gastosPendientes)[number]>[] = [
    { header: "Gasto", accessor: (e) => e.description },
    { header: "Proveedor", accessor: (e) => <span className="text-brand-muted">{e.supplierName ?? "—"}</span> },
    { header: "Fecha", accessor: (e) => <span className="text-brand-muted">{e.expense_date}</span> },
    { header: "Balance", accessor: (e) => <span className="font-medium">{formatMoneyPrecise(e.balance, e.currency)}</span> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-brand-text">
          <span className="h-2 w-2 rounded-full bg-[var(--chart-1)]" /> Cuentas por cobrar (facturado en el período)
        </h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <KpiCard label="Pendiente" value={formatMoney(cxc.pendiente)} icon={<ArrowDownCircle size={16} />} />
          <KpiCard label="Vencido" value={formatMoney(cxc.vencido)} danger icon={<AlertTriangle size={16} />} />
          <KpiCard label="Próx. 7 días" value={formatMoney(cxc.proximos7)} icon={<CalendarClock size={16} />} />
          <KpiCard label="Próx. 15 días" value={formatMoney(cxc.proximos15)} icon={<CalendarClock size={16} />} />
          <KpiCard label="Próx. 30 días" value={formatMoney(cxc.proximos30)} icon={<CalendarClock size={16} />} />
        </div>
      </section>

      <section>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-brand-text">
          <span className="h-2 w-2 rounded-full bg-[var(--chart-4)]" /> Cuentas por pagar (registrado en el período)
        </h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <KpiCard label="Pendiente" value={formatMoney(cxp.pendiente)} icon={<Wallet size={16} />} />
        </div>
        <p className="mt-2 text-xs text-brand-muted">
          Los gastos no tienen fecha de vencimiento registrada en el sistema todavía, así que aquí solo se muestra
          el pendiente total — a diferencia de las facturas, que sí tienen vencimiento.
        </p>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-medium text-brand-text">CxC pendiente vs. CxP pendiente</h3>
        <div className="rounded-[var(--radius-lg)] border border-brand-border bg-brand-surface p-4">
          <ComparisonBarChart
            data={[{ name: "Pendiente", "Por cobrar": Math.round(cxc.pendiente), "Por pagar": Math.round(cxp.pendiente) }]}
            xKey="name"
            bars={[
              { key: "Por cobrar", name: "Por cobrar", color: "var(--chart-1)" },
              { key: "Por pagar", name: "Por pagar", color: "var(--chart-4)" },
            ]}
            height={220}
          />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h3 className="mb-2 text-sm font-medium text-brand-text">Facturas vencidas ({cxc.count} pendientes en total)</h3>
          <DataTable
            columns={overdueColumns}
            rows={cxc.facturasVencidas}
            keyFor={(inv) => inv.id}
            emptyMessage="Sin facturas vencidas en este período. 🎉"
          />
        </section>
        <section>
          <h3 className="mb-2 text-sm font-medium text-brand-text">Gastos por pagar ({cxp.count} pendientes en total)</h3>
          <DataTable
            columns={payableColumns}
            rows={cxp.gastosPendientes}
            keyFor={(e) => e.id}
            emptyMessage="Sin gastos pendientes en este período."
          />
        </section>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. Ventas por cliente
// ---------------------------------------------------------------------------

async function SalesByClientTab({ period }: { period: Period }) {
  const { rows, totals } = await getSalesByClientComparison(period);
  const top = rows.slice(0, 8);

  const columns: Column<(typeof rows)[number]>[] = [
    { header: "Cliente", accessor: (c) => c.name },
    { header: "Ventas", accessor: (c) => <span className="font-medium">{formatMoneyPrecise(c.ventas)}</span> },
    { header: "Cobros", accessor: (c) => formatMoneyPrecise(c.cobros) },
    {
      header: "Saldo pendiente",
      accessor: (c) => (
        <span className={c.saldoPendiente > 0 ? "font-medium text-brand-warning" : "text-brand-muted"}>
          {formatMoneyPrecise(c.saldoPendiente)}
        </span>
      ),
    },
    { header: "vs. período anterior", accessor: (c) => <DeltaPill pct={c.deltaVentasPct} /> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <KpiCard label="Ventas totales" value={formatMoney(totals.ventas)} icon={<TrendingUp size={16} />} />
        <KpiCard label="Cobrado" value={formatMoney(totals.cobros)} icon={<Wallet size={16} />} />
        <KpiCard label="Saldo pendiente" value={formatMoney(totals.saldoPendiente)} icon={<ArrowDownCircle size={16} />} />
      </section>

      {top.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-medium text-brand-text">Ventas vs. cobros por cliente (top {top.length})</h3>
          <div className="rounded-[var(--radius-lg)] border border-brand-border bg-brand-surface p-4">
            <ComparisonBarChart
              data={top.map((c) => ({ name: c.name, Ventas: Math.round(c.ventas), Cobros: Math.round(c.cobros) }))}
              xKey="name"
              bars={[
                { key: "Ventas", name: "Ventas", color: "var(--chart-1)" },
                { key: "Cobros", name: "Cobros", color: "var(--chart-2)" },
              ]}
            />
          </div>
        </section>
      )}

      <section>
        <h3 className="mb-2 text-sm font-medium text-brand-text">Detalle por cliente ({rows.length})</h3>
        <DataTable
          columns={columns}
          rows={rows}
          keyFor={(c) => c.clientId}
          maxWidth="max-w-none"
          emptyMessage="Sin ventas ni cobros en este período."
        />
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 4. Rentabilidad por cliente
// ---------------------------------------------------------------------------

async function ClientProfitabilityTab({ period }: { period: Period }) {
  const { rows, totals } = await getClientProfitabilityComparison(period);
  const top = rows.slice(0, 8);

  const columns: Column<(typeof rows)[number]>[] = [
    { header: "Cliente", accessor: (c) => c.name },
    { header: "Ingresos", accessor: (c) => formatMoneyPrecise(c.ingresos) },
    { header: "Costos", accessor: (c) => formatMoneyPrecise(c.costos) },
    {
      header: "Utilidad",
      accessor: (c) => (
        <span className={c.utilidad < 0 ? "font-medium text-brand-danger" : "font-medium"}>{formatMoneyPrecise(c.utilidad)}</span>
      ),
    },
    { header: "Margen", accessor: (c) => <span className="text-brand-muted">{formatPercent(c.margen)}</span> },
    { header: "vs. período anterior", accessor: (c) => <DeltaPill pct={c.deltaUtilidadPct} /> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <KpiCard label="Ingresos" value={formatMoney(totals.ingresos)} icon={<TrendingUp size={16} />} />
        <KpiCard label="Costos" value={formatMoney(totals.costos)} icon={<CreditCard size={16} />} />
        <KpiCard
          label="Utilidad"
          value={formatMoney(totals.utilidad)}
          danger={totals.utilidad < 0}
          trend={totals.margen !== null ? `Margen ${formatPercent(totals.margen)}` : undefined}
          icon={<Award size={16} />}
        />
      </section>

      {top.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-medium text-brand-text">Ingresos vs. costos por cliente (top {top.length})</h3>
          <div className="rounded-[var(--radius-lg)] border border-brand-border bg-brand-surface p-4">
            <ComparisonBarChart
              data={top.map((c) => ({ name: c.name, Ingresos: Math.round(c.ingresos), Costos: Math.round(c.costos) }))}
              xKey="name"
              bars={[
                { key: "Ingresos", name: "Ingresos", color: "var(--chart-1)" },
                { key: "Costos", name: "Costos", color: "var(--chart-4)" },
              ]}
            />
          </div>
        </section>
      )}

      <section>
        <h3 className="mb-2 text-sm font-medium text-brand-text">Detalle por cliente ({rows.length})</h3>
        <DataTable
          columns={columns}
          rows={rows}
          keyFor={(c) => c.clientId}
          maxWidth="max-w-none"
          emptyMessage="Sin facturación en este período."
        />
        <p className="mt-2 text-xs text-brand-muted">
          Los costos son los gastos de los proyectos de cada cliente en el período. Los gastos generales sin
          proyecto asignado no se pueden atribuir a un cliente y no entran en este cálculo.
        </p>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 5. Período actual vs. período anterior
// ---------------------------------------------------------------------------

async function PeriodOverPeriodTab({ period }: { period: Period }) {
  const data = await getPeriodOverPeriodComparison(period);

  const chartData = [
    { name: "Ventas", Actual: Math.round(data.current.ventas), Anterior: Math.round(data.previous.ventas) },
    { name: "Gastos", Actual: Math.round(data.current.gastos), Anterior: Math.round(data.previous.gastos) },
    { name: "Utilidad", Actual: Math.round(data.current.utilidad), Anterior: Math.round(data.previous.utilidad) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Ventas"
          value={formatMoney(data.current.ventas)}
          trend={data.deltaVentas.pct !== null ? `${data.deltaVentas.pct >= 0 ? "+" : ""}${data.deltaVentas.pct.toFixed(1)}%` : undefined}
          icon={<TrendingUp size={16} />}
        />
        <KpiCard
          label="Gastos"
          value={formatMoney(data.current.gastos)}
          trend={data.deltaGastos.pct !== null ? `${data.deltaGastos.pct >= 0 ? "+" : ""}${data.deltaGastos.pct.toFixed(1)}%` : undefined}
          icon={<CreditCard size={16} />}
        />
        <KpiCard
          label="Utilidad"
          value={formatMoney(data.current.utilidad)}
          danger={data.current.utilidad < 0}
          trend={data.deltaUtilidad.pct !== null ? `${data.deltaUtilidad.pct >= 0 ? "+" : ""}${data.deltaUtilidad.pct.toFixed(1)}%` : undefined}
          icon={<Award size={16} />}
        />
        <KpiCard
          label="Margen"
          value={formatPercent(data.current.margen)}
          trend={data.deltaMargen !== null ? `${data.deltaMargen >= 0 ? "+" : ""}${data.deltaMargen.toFixed(1)} pts` : undefined}
          icon={<CalendarRange size={16} />}
        />
      </section>

      <section>
        <h3 className="mb-2 text-sm font-medium text-brand-text">
          {period.label} vs. {period.prevLabel}
        </h3>
        <div className="rounded-[var(--radius-lg)] border border-brand-border bg-brand-surface p-4">
          <ComparisonBarChart
            data={chartData}
            xKey="name"
            bars={[
              { key: "Actual", name: period.label, color: "var(--chart-1)" },
              { key: "Anterior", name: period.prevLabel, color: "var(--chart-5)" },
            ]}
          />
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-medium text-brand-text">Detalle</h3>
        <DataTable columns={periodDetailColumns(period)} rows={periodDetailRows(data)} keyFor={(r) => r.metric} maxWidth="max-w-3xl" />
      </section>
    </div>
  );
}

type PeriodDetailRow = {
  metric: string;
  isPercent: boolean;
  current: number;
  previous: number;
  deltaAbs: number;
  deltaPct: number | null;
  positiveIsGood: boolean;
};

function periodDetailRows(data: Awaited<ReturnType<typeof getPeriodOverPeriodComparison>>): PeriodDetailRow[] {
  return [
    {
      metric: "Ventas",
      isPercent: false,
      current: data.current.ventas,
      previous: data.previous.ventas,
      deltaAbs: data.deltaVentas.abs,
      deltaPct: data.deltaVentas.pct,
      positiveIsGood: true,
    },
    {
      metric: "Gastos",
      isPercent: false,
      current: data.current.gastos,
      previous: data.previous.gastos,
      deltaAbs: data.deltaGastos.abs,
      deltaPct: data.deltaGastos.pct,
      positiveIsGood: false,
    },
    {
      metric: "Utilidad",
      isPercent: false,
      current: data.current.utilidad,
      previous: data.previous.utilidad,
      deltaAbs: data.deltaUtilidad.abs,
      deltaPct: data.deltaUtilidad.pct,
      positiveIsGood: true,
    },
    {
      metric: "Margen",
      isPercent: true,
      current: data.current.margen ?? 0,
      previous: data.previous.margen ?? 0,
      deltaAbs: data.deltaMargen ?? 0,
      deltaPct: data.deltaMargen,
      positiveIsGood: true,
    },
  ];
}

function formatDetailValue(row: PeriodDetailRow, usePrevious = false) {
  const value = usePrevious ? row.previous : row.current;
  return row.isPercent ? `${value.toFixed(1)}%` : formatMoneyPrecise(value);
}

function formatDetailDelta(row: PeriodDetailRow) {
  const sign = row.deltaAbs >= 0 ? "+" : "";
  return row.isPercent ? `${sign}${row.deltaAbs.toFixed(1)} pts` : `${sign}${formatMoneyPrecise(row.deltaAbs)}`;
}

function periodDetailColumns(period: Period): Column<PeriodDetailRow>[] {
  return [
    { header: "Métrica", accessor: (r) => <span className="font-medium">{r.metric}</span> },
    { header: period.label, accessor: (r) => formatDetailValue(r) },
    { header: period.prevLabel, accessor: (r) => <span className="text-brand-muted">{formatDetailValue(r, true)}</span> },
    { header: "Diferencia", accessor: (r) => formatDetailDelta(r) },
    { header: "%", accessor: (r) => <DeltaPill pct={r.deltaPct} positiveIsGood={r.positiveIsGood} /> },
  ];
}
