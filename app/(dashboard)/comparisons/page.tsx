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
  Info,
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

/** Cada pestaña con su explicación sencilla: qué muestra y para qué sirve. */
const TABS: { key: string; label: string; icon: React.ComponentType<{ size?: number }>; help: string }[] = [
  {
    key: "rentabilidad-proyecto",
    label: "Rentabilidad por proyecto",
    icon: TrendingUp,
    help: "Cuánto ganó cada proyecto (evento) cuya fecha cae en el período: lo facturado menos lo gastado, sin ITBIS, y si le fue mejor o peor que en el período anterior. Sirve para saber qué eventos dejan más ganancia y cuáles perdieron dinero.",
  },
  {
    key: "cxc-cxp",
    label: "CxC vs. CxP",
    icon: ArrowLeftRight,
    help: "CxC = cuentas por cobrar (lo que te deben los clientes); CxP = cuentas por pagar (lo que le debes a tus proveedores). Compara las dos para ver si lo que vas a cobrar alcanza para lo que tienes que pagar, y qué cobros vencen pronto.",
  },
  {
    key: "ventas-cliente",
    label: "Ventas por cliente",
    icon: Users,
    help: "Cuánto le facturaste a cada cliente en el período, cuánto te pagó y cuánto te debe todavía. Sirve para ver quiénes son tus mejores clientes y a quién hay que cobrarle.",
  },
  {
    key: "rentabilidad-cliente",
    label: "Rentabilidad por cliente",
    icon: Award,
    help: "Cuánto ganaste con cada cliente: lo que le facturaste menos lo que gastaste en sus proyectos, sin ITBIS. Un cliente puede comprar mucho y dejar poca ganancia: aquí se ve.",
  },
  {
    key: "periodo-vs-periodo",
    label: "Período vs. período",
    icon: CalendarRange,
    help: "Ventas, gastos, ganancia y margen de todo el negocio en el período, comparados con el período anterior del mismo largo (ej. este mes contra el mes pasado). Sirve para ver si el negocio va mejor o peor.",
  },
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
              title={t.help}
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

      {/* Para qué sirve la pestaña elegida, en palabras sencillas. */}
      <p className="-mt-2 flex items-start gap-2 rounded-[var(--radius-md)] border border-brand-accent/20 bg-brand-accent-light px-3 py-2 text-sm text-brand-text">
        <Info size={16} className="mt-0.5 shrink-0 text-brand-accent" aria-hidden />
        <span>
          <strong>{TABS.find((t) => t.key === activeTab)?.label}:</strong> {TABS.find((t) => t.key === activeTab)?.help}{" "}
          <span className="text-brand-muted">Pasa el mouse por las otras pestañas para ver de qué trata cada una.</span>
        </span>
      </p>

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
    {
      header: "Proyecto",
      accessor: (p) => (
        <span className="block min-w-[9rem]">
          <span className="block font-semibold tabular-nums text-brand-text">{p.number}</span>
          <span className="text-xs text-brand-muted">{p.name}</span>
        </span>
      ),
    },
    { header: "Estado", accessor: (p) => <Badge status={p.status}>{PROJECT_STATUS_LABELS[p.status] ?? p.status}</Badge> },
    { header: "Ingresos", info: "Lo que vendiste: las facturas emitidas en el período (no cuentan borradores ni canceladas), sin el ITBIS, porque el ITBIS que cobras es de la DGII.", accessor: (p) => formatMoneyPrecise(p.ingresos) },
    { header: "Gastos", info: "Lo que gastaste: los gastos registrados en el período, pagados o no (no cuentan los cancelados), sin el ITBIS, porque ese ITBIS no es costo.", accessor: (p) => formatMoneyPrecise(p.gastos) },
    {
      header: "Utilidad",
      info: "La ganancia: lo que vendiste menos lo que gastaste, los dos sin ITBIS. Si es negativa, gastaste más de lo que vendiste.",
      accessor: (p) => (
        <span className={p.utilidad < 0 ? "font-medium text-brand-danger" : "font-medium"}>{formatMoneyPrecise(p.utilidad)}</span>
      ),
    },
    { header: "Margen", info: "Qué parte de lo vendido te quedó de ganancia. Ej.: 20 % = de cada RD$100 vendidos te quedaron RD$20 después de los gastos.", accessor: (p) => <span className="text-brand-muted">{formatPercent(p.margen)}</span> },
    { header: "vs. período anterior", info: "Cuánto subió (verde) o bajó (rojo) comparado con el período anterior del mismo largo.", accessor: (p) => <DeltaPill pct={p.deltaUtilidadPct} /> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <KpiCard
          label="Ventas sin ITBIS (facturas emitidas)"
          info={"Lo que vendiste: las facturas emitidas en el período (no cuentan borradores ni canceladas), sin el ITBIS, porque el ITBIS que cobras es de la DGII."}
          value={formatMoney(totals.ingresos)}
          trend={totals.deltaIngresosPct !== null ? `${totals.deltaIngresosPct >= 0 ? "+" : ""}${totals.deltaIngresosPct.toFixed(1)}%` : undefined}
          icon={<TrendingUp size={16} />}
        />
        <KpiCard
          label="Gastos sin ITBIS (gastos registrados)"
          info={"Lo que gastaste: los gastos registrados en el período, pagados o no (no cuentan los cancelados), sin el ITBIS, porque ese ITBIS no es costo."}
          value={formatMoney(totals.gastos)}
          trend={totals.deltaGastosPct !== null ? `${totals.deltaGastosPct >= 0 ? "+" : ""}${totals.deltaGastosPct.toFixed(1)}%` : undefined}
          icon={<CreditCard size={16} />}
        />
        <KpiCard
          label="Utilidad"
          info={"La ganancia: lo que vendiste menos lo que gastaste, los dos sin ITBIS. Si es negativa, gastaste más de lo que vendiste."}
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
          <span className="h-2 w-2 rounded-full bg-[var(--chart-1)]" /> Cuentas por cobrar — lo que te deben los clientes (facturado en el período)
        </h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <KpiCard label="Pendiente" info="Lo que los clientes todavía te deben de las facturas emitidas en el período." value={formatMoney(cxc.pendiente)} icon={<ArrowDownCircle size={16} />} />
          <KpiCard label="Vencido" info="La parte de lo pendiente que ya pasó su fecha de pago (atrasada)." value={formatMoney(cxc.vencido)} danger icon={<AlertTriangle size={16} />} />
          <KpiCard label="Próx. 7 días" info="Lo que los clientes deben pagar en los próximos 7 días." value={formatMoney(cxc.proximos7)} icon={<CalendarClock size={16} />} />
          <KpiCard label="Próx. 15 días" info="Lo que deben pagar en los próximos 15 días (incluye los 7)." value={formatMoney(cxc.proximos15)} icon={<CalendarClock size={16} />} />
          <KpiCard label="Próx. 30 días" info="Lo que deben pagar en los próximos 30 días (incluye los 15)." value={formatMoney(cxc.proximos30)} icon={<CalendarClock size={16} />} />
        </div>
      </section>

      <section>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-brand-text">
          <span className="h-2 w-2 rounded-full bg-[var(--chart-4)]" /> Cuentas por pagar — lo que le debes a tus proveedores (registrado en el período)
        </h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <KpiCard label="Pendiente" info="Lo que todavía le debes a tus proveedores por los gastos registrados en el período." value={formatMoney(cxp.pendiente)} icon={<Wallet size={16} />} />
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
    { header: "Ventas", info: "Facturas emitidas al cliente en el período, con ITBIS.", accessor: (c) => <span className="font-medium">{formatMoneyPrecise(c.ventas)}</span> },
    { header: "Cobros", info: "Lo que el cliente pagó en el período.", accessor: (c) => formatMoneyPrecise(c.cobros) },
    {
      header: "Saldo pendiente",
      info: "Lo que el cliente todavía debe.",
      accessor: (c) => (
        <span className={c.saldoPendiente > 0 ? "font-medium text-brand-warning" : "text-brand-muted"}>
          {formatMoneyPrecise(c.saldoPendiente)}
        </span>
      ),
    },
    { header: "vs. período anterior", info: "Cuánto subió (verde) o bajó (rojo) comparado con el período anterior del mismo largo.", accessor: (c) => <DeltaPill pct={c.deltaVentasPct} /> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <KpiCard label="Ventas totales (facturado)" info="Total de las facturas emitidas en el período, con ITBIS, como dicen las facturas. (Para la ganancia sin ITBIS, mira Rentabilidad por cliente.)" value={formatMoney(totals.ventas)} icon={<TrendingUp size={16} />} />
        <KpiCard label="Cobrado" info="Dinero que esos clientes ya pagaron en el período." value={formatMoney(totals.cobros)} icon={<Wallet size={16} />} />
        <KpiCard label="Saldo pendiente" info="Lo que esos clientes todavía deben de esas facturas." value={formatMoney(totals.saldoPendiente)} icon={<ArrowDownCircle size={16} />} />
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
    { header: "Ingresos", info: "Lo que vendiste: las facturas emitidas en el período (no cuentan borradores ni canceladas), sin el ITBIS, porque el ITBIS que cobras es de la DGII.", accessor: (c) => formatMoneyPrecise(c.ingresos) },
    { header: "Costos", info: "Lo que gastaste: los gastos registrados en el período, pagados o no (no cuentan los cancelados), sin el ITBIS, porque ese ITBIS no es costo.", accessor: (c) => formatMoneyPrecise(c.costos) },
    {
      header: "Utilidad",
      info: "La ganancia: lo que vendiste menos lo que gastaste, los dos sin ITBIS. Si es negativa, gastaste más de lo que vendiste.",
      accessor: (c) => (
        <span className={c.utilidad < 0 ? "font-medium text-brand-danger" : "font-medium"}>{formatMoneyPrecise(c.utilidad)}</span>
      ),
    },
    { header: "Margen", info: "Qué parte de lo vendido te quedó de ganancia. Ej.: 20 % = de cada RD$100 vendidos te quedaron RD$20 después de los gastos.", accessor: (c) => <span className="text-brand-muted">{formatPercent(c.margen)}</span> },
    { header: "vs. período anterior", info: "Cuánto subió (verde) o bajó (rojo) comparado con el período anterior del mismo largo.", accessor: (c) => <DeltaPill pct={c.deltaUtilidadPct} /> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <KpiCard label="Ventas sin ITBIS (facturas emitidas)" info={"Lo que vendiste: las facturas emitidas en el período (no cuentan borradores ni canceladas), sin el ITBIS, porque el ITBIS que cobras es de la DGII."} value={formatMoney(totals.ingresos)} icon={<TrendingUp size={16} />} />
        <KpiCard label="Costos sin ITBIS (gastos de sus proyectos)" info={"Lo que gastaste: los gastos registrados en el período, pagados o no (no cuentan los cancelados), sin el ITBIS, porque ese ITBIS no es costo."} value={formatMoney(totals.costos)} icon={<CreditCard size={16} />} />
        <KpiCard
          info={"La ganancia: lo que vendiste menos lo que gastaste, los dos sin ITBIS. Si es negativa, gastaste más de lo que vendiste."}
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
          label="Ventas sin ITBIS (facturas emitidas)"
          info={"Lo que vendiste: las facturas emitidas en el período (no cuentan borradores ni canceladas), sin el ITBIS, porque el ITBIS que cobras es de la DGII."}
          value={formatMoney(data.current.ventas)}
          trend={data.deltaVentas.pct !== null ? `${data.deltaVentas.pct >= 0 ? "+" : ""}${data.deltaVentas.pct.toFixed(1)}%` : undefined}
          icon={<TrendingUp size={16} />}
        />
        <KpiCard
          label="Gastos sin ITBIS (gastos registrados)"
          info={"Lo que gastaste: los gastos registrados en el período, pagados o no (no cuentan los cancelados), sin el ITBIS, porque ese ITBIS no es costo."}
          value={formatMoney(data.current.gastos)}
          trend={data.deltaGastos.pct !== null ? `${data.deltaGastos.pct >= 0 ? "+" : ""}${data.deltaGastos.pct.toFixed(1)}%` : undefined}
          icon={<CreditCard size={16} />}
        />
        <KpiCard
          label="Utilidad"
          info={"La ganancia: lo que vendiste menos lo que gastaste, los dos sin ITBIS. Si es negativa, gastaste más de lo que vendiste."}
          value={formatMoney(data.current.utilidad)}
          danger={data.current.utilidad < 0}
          trend={data.deltaUtilidad.pct !== null ? `${data.deltaUtilidad.pct >= 0 ? "+" : ""}${data.deltaUtilidad.pct.toFixed(1)}%` : undefined}
          icon={<Award size={16} />}
        />
        <KpiCard
          label="Margen"
          info={"Qué parte de lo vendido te quedó de ganancia. Ej.: 20 % = de cada RD$100 vendidos te quedaron RD$20 después de los gastos."}
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
      metric: "Ventas sin ITBIS",
      isPercent: false,
      current: data.current.ventas,
      previous: data.previous.ventas,
      deltaAbs: data.deltaVentas.abs,
      deltaPct: data.deltaVentas.pct,
      positiveIsGood: true,
    },
    {
      metric: "Gastos sin ITBIS",
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
