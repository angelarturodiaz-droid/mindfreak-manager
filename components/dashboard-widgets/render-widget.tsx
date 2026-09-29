import {
  ArrowUpCircle,
  PiggyBank,
  FolderKanban,
  FileClock,
  Clock,
  Wallet,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { FinancialFlowChart } from "@/app/(dashboard)/dashboard/financial-flow-chart";
import type { DashboardWidgetBundle } from "@/features/dashboard-widgets/bundle";
import { KpiTile, Panel, BarRow, MiniList, type Tone } from "./parts";

function money(amount: number) {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP" }).format(amount);
}

function moneyShort(amount: number) {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    notation: Math.abs(amount) >= 100000 ? "compact" : "standard",
    maximumFractionDigits: Math.abs(amount) >= 100000 ? 1 : 0,
  }).format(amount);
}

/** Monto sin centavos para los indicadores (el exacto va en el title). */
function money0(amount: number, currency = "DOP") {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

function moneyIn(amount: number, currency: string) {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency }).format(amount);
}

/** "Ahorros RD$X · Corriente RD$Y" (solo lo que tenga saldo). */
function cashBreakdown(c: { savings: number; checking: number; other: number; count: number }, currency: string) {
  if (c.count === 0) return `Sin cuentas en ${currency === "USD" ? "dólares" : "pesos"}`;
  const parts: string[] = [];
  if (c.savings !== 0) parts.push(`Ahorros ${money0(c.savings, currency)}`);
  if (c.checking !== 0) parts.push(`Corriente ${money0(c.checking, currency)}`);
  if (c.other !== 0) parts.push(`Sin tipo ${money0(c.other, currency)}`);
  return parts.length ? parts.join(" · ") : `${c.count} cuenta${c.count === 1 ? "" : "s"}`;
}

function percent(value: number | null) {
  return value === null ? "—" : `${value.toFixed(1)}%`;
}

/** a / b en %, o null si b es 0. */
function ratio(a: number, b: number) {
  return b > 0 ? (a / b) * 100 : null;
}

function oneOf<T>(value: T | T[] | null): T | undefined {
  return Array.isArray(value) ? value[0] : (value ?? undefined);
}

function clientName(v: unknown) {
  return oneOf(v as { name: string } | { name: string }[] | null)?.name;
}

const PRIORITY: Record<string, { text: string; tone: Tone }> = {
  URGENT: { text: "Urgente", tone: "danger" },
  HIGH: { text: "Alta", tone: "warning" },
  MEDIUM: { text: "Media", tone: "accent" },
  LOW: { text: "Baja", tone: "teal" },
};

export function renderWidget(type: string, data: DashboardWidgetBundle): React.ReactNode {
  const { kpis, flow, receivables, recentPayments, recentSupplierPayments, pendingTasks, topProjects, bankCash } = data;
  const vencidoPct = ratio(receivables.totalVencido, receivables.totalPorCobrar);

  switch (type) {
    // ─── Indicadores (franja de arriba) ────────────────────────────────
    case "disponible_bancos_dop":
      return (
        <KpiTile
          href="/banks"
          label="En bancos · pesos"
          value={money0(bankCash.dop.total, "DOP")}
          title={moneyIn(bankCash.dop.total, "DOP")}
          danger={bankCash.dop.total < 0}
          sub={cashBreakdown(bankCash.dop, "DOP")}
          icon={<Wallet size={20} />}
          tone="accent"
        />
      );
    case "disponible_bancos_usd":
      return (
        <KpiTile
          href="/banks"
          label="En bancos · dólares"
          value={money0(bankCash.usd.total, "USD")}
          title={moneyIn(bankCash.usd.total, "USD")}
          danger={bankCash.usd.total < 0}
          sub={cashBreakdown(bankCash.usd, "USD")}
          icon={<DollarSign size={20} />}
          tone="teal"
        />
      );
    case "ingresos_mes":
      return (
        <KpiTile
          href="/invoices"
          label="Ventas del mes"
          value={money0(kpis.ventas)}
          title={money(kpis.ventas)}
          ring={{ value: ratio(kpis.cobros, kpis.ventas), tone: "success", label: "Cobrado vs. facturado este mes" }}
          sub={`Cobrado este mes ${money0(kpis.cobros)}`}
          subTone="success"
        />
      );
    case "gastos_mes":
      return (
        <KpiTile
          href="/expenses"
          label="Gastos del mes"
          value={money0(kpis.gastos)}
          title={money(kpis.gastos)}
          ring={{ value: ratio(kpis.gastos, kpis.ventas), tone: "warning", label: "Gastos como % de las ventas" }}
          sub={kpis.ventas > 0 ? "de las ventas del mes" : `Pagado ${money0(kpis.pagos)}`}
        />
      );
    case "utilidad_mes":
      return (
        <KpiTile
          label="Utilidad del mes"
          value={money0(kpis.utilidad)}
          title={money(kpis.utilidad)}
          danger={kpis.utilidad < 0}
          icon={<PiggyBank size={20} />}
          tone={kpis.utilidad < 0 ? "danger" : "success"}
          sub="Ventas − gastos del mes"
        />
      );
    case "margen_mes":
      return (
        <KpiTile
          label="Margen del mes"
          value={percent(kpis.margen)}
          danger={(kpis.margen ?? 0) < 0}
          ring={{ value: kpis.margen, tone: (kpis.margen ?? 0) < 0 ? "danger" : "success", label: "Utilidad / ventas" }}
          sub="Utilidad sobre ventas"
        />
      );
    case "total_por_cobrar":
      return (
        <KpiTile
          href="/reports"
          label="Por cobrar"
          value={money0(receivables.totalPorCobrar)}
          title={money(receivables.totalPorCobrar)}
          ring={{ value: vencidoPct, tone: "danger", label: "% vencido" }}
          sub={receivables.totalVencido > 0 ? `Vencido ${money0(receivables.totalVencido)}` : "Nada vencido"}
          subTone={receivables.totalVencido > 0 ? "danger" : "success"}
        />
      );
    case "total_vencido":
      return (
        <KpiTile
          href="/reports"
          label="Total vencido"
          value={money0(receivables.totalVencido)}
          title={money(receivables.totalVencido)}
          danger={receivables.totalVencido > 0}
          ring={{ value: vencidoPct, tone: "danger", label: "% de lo por cobrar" }}
          sub={`de ${money0(receivables.totalPorCobrar)} por cobrar`}
        />
      );
    case "vence_hoy":
      return (
        <KpiTile
          href="/reports"
          label="Vence hoy"
          value={money0(receivables.totalVenceHoy)}
          title={money(receivables.totalVenceHoy)}
          icon={<Clock size={20} />}
          tone="warning"
          sub={`Próximos 7 días ${money0(receivables.totalProximos7)}`}
        />
      );
    case "total_por_pagar":
      return (
        <KpiTile
          href="/expenses"
          label="Por pagar"
          value={money0(kpis.cuentasPorPagar)}
          title={money(kpis.cuentasPorPagar)}
          icon={<ArrowUpCircle size={20} />}
          tone="warning"
          sub={`Pagado este mes ${money0(kpis.pagos)}`}
        />
      );
    case "proyectos_activos":
      return (
        <KpiTile
          href="/projects"
          label="Proyectos activos"
          value={String(kpis.proyectosActivos)}
          icon={<FolderKanban size={20} />}
          tone="violet"
          sub="En planificación o en curso"
        />
      );
    case "cotizaciones_pendientes":
      return (
        <KpiTile
          href="/quotations"
          label="Cotizaciones pendientes"
          value={String(kpis.cotizacionesPendientes)}
          icon={<FileClock size={20} />}
          tone="accent"
          sub={`${kpis.cotizacionesAprobadas} aprobada${kpis.cotizacionesAprobadas === 1 ? "" : "s"}`}
          subTone="success"
        />
      );

    // ─── Paneles (gráficos y listas) ───────────────────────────────────
    case "flujo_financiero": {
      const totalCobros = flow.reduce((a, p) => a + p.cobros, 0);
      const totalPagos = flow.reduce((a, p) => a + p.pagos, 0);
      const last = flow[flow.length - 1];
      const prev = flow[flow.length - 2];
      const delta = last && prev && prev.cobros > 0 ? ((last.cobros - prev.cobros) / prev.cobros) * 100 : null;
      return (
        <Panel
          title="Flujo financiero · últimos 6 meses"
          href="/reports"
          right={
            delta !== null && (
              <span
                className={`flex items-center gap-0.5 font-medium ${delta >= 0 ? "text-brand-success" : "text-brand-danger"}`}
                title="Cobros de este mes vs. el mes anterior"
              >
                {delta >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                {Math.abs(delta).toFixed(0)}% cobros vs. mes anterior
              </span>
            )
          }
        >
          <div className="mb-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-brand-muted">
            <span>
              <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-brand-success" />
              Cobros <strong className="text-brand-text">{moneyShort(totalCobros)}</strong>
            </span>
            <span>
              <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-brand-danger" />
              Pagos <strong className="text-brand-text">{moneyShort(totalPagos)}</strong>
            </span>
            <span>
              Neto{" "}
              <strong className={totalCobros - totalPagos < 0 ? "text-brand-danger" : "text-brand-success"}>
                {moneyShort(totalCobros - totalPagos)}
              </strong>
            </span>
          </div>
          <FinancialFlowChart data={flow} />
        </Panel>
      );
    }
    case "cobros_por_vencer": {
      const r = receivables;
      const buckets: { label: string; value: number; tone: Tone }[] = [
        { label: "Vencido", value: r.totalVencido, tone: "danger" },
        { label: "Vence hoy", value: r.totalVenceHoy, tone: "warning" },
        { label: "Próximos 7 días", value: r.totalProximos7, tone: "accent" },
        { label: "8 a 15 días", value: Math.max(0, r.totalProximos15 - r.totalProximos7), tone: "teal" },
        { label: "16 a 30 días", value: Math.max(0, r.totalProximos30 - r.totalProximos15), tone: "violet" },
      ];
      const max = Math.max(...buckets.map((b) => b.value), 1);
      return (
        <Panel title="Por cobrar por vencimiento" href="/reports">
          <div className="flex flex-col gap-3.5">
            {buckets.map((b) => (
              <BarRow
                key={b.label}
                label={b.label}
                valueLabel={money(b.value)}
                pct={(b.value / max) * 100}
                tone={b.tone}
              />
            ))}
          </div>
          <p className="mt-4 flex items-center justify-between border-t border-brand-border pt-3 text-xs text-brand-muted">
            Total por cobrar
            <strong className="text-sm tabular-nums text-brand-text">{money(r.totalPorCobrar)}</strong>
          </p>
        </Panel>
      );
    }
    case "facturas_vencidas":
      return (
        <Panel
          title={`Facturas vencidas (${receivables.facturasVencidas.length})`}
          href="/invoices"
          right={receivables.totalVencido > 0 && <span className="text-brand-danger">{moneyShort(receivables.totalVencido)}</span>}
        >
          <MiniList
            empty="Sin facturas vencidas. 🎉"
            rows={receivables.facturasVencidas.slice(0, 5).map((inv) => ({
              key: inv.id,
              left: inv.number,
              sub: clientName(inv.clients),
              right: money(inv.balance),
              chip: { text: `${inv.daysOverdue} día${inv.daysOverdue === 1 ? "" : "s"} vencida`, tone: "danger" },
            }))}
          />
        </Panel>
      );
    case "facturas_proximas":
      return (
        <Panel title="Próximas a vencer (30 días)" href="/invoices">
          <MiniList
            empty="Sin facturas próximas."
            rows={receivables.facturasProximasAVencer.slice(0, 5).map((inv) => ({
              key: inv.id,
              left: inv.number,
              sub: clientName(inv.clients),
              right: money(inv.balance),
              chip:
                inv.daysUntilDue === 0
                  ? { text: "Vence hoy", tone: "warning" }
                  : { text: `en ${inv.daysUntilDue} días`, tone: (inv.daysUntilDue ?? 99) <= 7 ? "warning" : "accent" },
            }))}
          />
        </Panel>
      );
    case "ultimos_cobros":
      return (
        <Panel title="Últimos cobros" href="/payments">
          <MiniList
            empty="Sin cobros registrados."
            rows={recentPayments.map((p) => ({
              key: p.id,
              left: clientName(p.clients) ?? "—",
              sub: p.payment_date,
              right: <span className="text-brand-success">{money(p.amount)}</span>,
            }))}
          />
        </Panel>
      );
    case "ultimos_pagos":
      return (
        <Panel title="Últimos pagos" href="/expenses">
          <MiniList
            empty="Sin pagos registrados."
            rows={recentSupplierPayments.map((p) => ({
              key: p.id,
              left: oneOf(p.suppliers as { name: string } | { name: string }[] | null)?.name ?? "—",
              sub: p.payment_date,
              right: money(p.amount),
            }))}
          />
        </Panel>
      );
    case "tareas_pendientes":
      return (
        <Panel title="Tareas pendientes" href="/tasks">
          <MiniList
            empty="Sin tareas pendientes."
            rows={pendingTasks.map((t) => ({
              key: t.id,
              left: t.title,
              sub: t.due_date ? `Vence ${t.due_date}` : undefined,
              right: "",
              chip: t.priority ? (PRIORITY[t.priority] ?? { text: t.priority, tone: "accent" }) : undefined,
            }))}
          />
        </Panel>
      );
    case "rentabilidad_proyectos":
      return (
        <Panel title="Rentabilidad por proyecto (top 5)" href="/reports">
          {topProjects.length === 0 ? (
            <p className="py-4 text-center text-sm text-brand-muted">Sin proyectos facturados todavía.</p>
          ) : (
            <div className="flex flex-col gap-3.5">
              {topProjects.map((p) => (
                <BarRow
                  key={p.id}
                  label={`${p.number} — ${p.name}`}
                  valueLabel={percent(p.margenReal)}
                  pct={Math.abs(p.margenReal ?? 0)}
                  tone={(p.margenReal ?? 0) < 0 ? "danger" : "success"}
                />
              ))}
            </div>
          )}
        </Panel>
      );
    default:
      return (
        <Panel title={type}>
          <p className="text-sm text-brand-muted">Widget desconocido.</p>
        </Panel>
      );
  }
}
