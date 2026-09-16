import Link from "next/link";
import {
  TrendingUp,
  CreditCard,
  ArrowDownCircle,
  ArrowUpCircle,
  PiggyBank,
  Percent,
  FolderKanban,
  FileClock,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { KpiCard, Card } from "@/components/ui/card";
import { FinancialFlowChart } from "@/app/(dashboard)/dashboard/financial-flow-chart";
import type { DashboardWidgetBundle } from "@/features/dashboard-widgets/bundle";

function money(amount: number) {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP" }).format(amount);
}

function percent(value: number | null) {
  return value === null ? "—" : `${value.toFixed(1)}%`;
}

function oneOf<T>(value: T | T[] | null): T | undefined {
  return Array.isArray(value) ? value[0] : (value ?? undefined);
}

function MiniList({
  rows,
  empty,
}: {
  rows: { key: string; left: string; right: string; sub?: string }[];
  empty: string;
}) {
  if (rows.length === 0) return <p className="text-sm text-brand-muted">{empty}</p>;
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((r) => (
        <li key={r.key} className="flex items-center justify-between gap-3 text-sm">
          <div className="min-w-0">
            <p className="truncate text-brand-text">{r.left}</p>
            {r.sub && <p className="truncate text-xs text-brand-muted">{r.sub}</p>}
          </div>
          <span className="shrink-0 font-medium">{r.right}</span>
        </li>
      ))}
    </ul>
  );
}

/** Título + contenido, para los widgets que no son un KpiCard suelto. */
function WidgetCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="flex h-full flex-col gap-3">
      <h3 className="text-sm font-medium text-brand-text">{title}</h3>
      {children}
    </Card>
  );
}

export function renderWidget(type: string, data: DashboardWidgetBundle): React.ReactNode {
  const { kpis, flow, receivables, recentPayments, recentSupplierPayments, pendingTasks, topProjects } = data;

  switch (type) {
    case "total_por_cobrar":
      return <KpiCard label="Total por cobrar" value={money(receivables.totalPorCobrar)} icon={<ArrowDownCircle size={16} />} />;
    case "total_vencido":
      return <KpiCard label="Total vencido" value={money(receivables.totalVencido)} danger icon={<AlertTriangle size={16} />} />;
    case "vence_hoy":
      return <KpiCard label="Vence hoy" value={money(receivables.totalVenceHoy)} danger icon={<Clock size={16} />} />;
    case "total_por_pagar":
      return <KpiCard label="Cuentas por pagar" value={money(kpis.cuentasPorPagar)} icon={<ArrowUpCircle size={16} />} />;
    case "ingresos_mes":
      return <KpiCard label="Ventas (mes)" value={money(kpis.ventas)} icon={<TrendingUp size={16} />} />;
    case "gastos_mes":
      return <KpiCard label="Gastos (mes)" value={money(kpis.gastos)} icon={<CreditCard size={16} />} />;
    case "utilidad_mes":
      return <KpiCard label="Utilidad (mes)" value={money(kpis.utilidad)} danger={kpis.utilidad < 0} icon={<PiggyBank size={16} />} />;
    case "margen_mes":
      return <KpiCard label="Margen (mes)" value={percent(kpis.margen)} icon={<Percent size={16} />} />;
    case "proyectos_activos":
      return (
        <Link href="/projects">
          <KpiCard label="Proyectos activos" value={String(kpis.proyectosActivos)} icon={<FolderKanban size={16} />} />
        </Link>
      );
    case "cotizaciones_pendientes":
      return (
        <Link href="/quotations">
          <KpiCard label="Cotizaciones pendientes" value={String(kpis.cotizacionesPendientes)} icon={<FileClock size={16} />} />
        </Link>
      );
    case "flujo_financiero":
      return (
        <WidgetCard title="Flujo financiero (últimos 6 meses)">
          <FinancialFlowChart data={flow} />
        </WidgetCard>
      );
    case "facturas_vencidas":
      return (
        <WidgetCard title={`Facturas vencidas (${receivables.facturasVencidas.length})`}>
          <MiniList
            empty="Sin facturas vencidas. 🎉"
            rows={receivables.facturasVencidas.slice(0, 6).map((inv) => ({
              key: inv.id,
              left: inv.number,
              sub: oneOf(inv.clients as { name: string } | { name: string }[] | null)?.name,
              right: money(inv.balance),
            }))}
          />
        </WidgetCard>
      );
    case "facturas_proximas":
      return (
        <WidgetCard title="Facturas próximas a vencer">
          <MiniList
            empty="Sin facturas próximas."
            rows={receivables.facturasProximasAVencer.slice(0, 6).map((inv) => ({
              key: inv.id,
              left: inv.number,
              sub: `${oneOf(inv.clients as { name: string } | { name: string }[] | null)?.name ?? ""} · en ${inv.daysUntilDue} días`,
              right: money(inv.balance),
            }))}
          />
        </WidgetCard>
      );
    case "ultimos_cobros":
      return (
        <WidgetCard title="Últimos cobros">
          <MiniList
            empty="Sin cobros registrados."
            rows={recentPayments.map((p) => ({
              key: p.id,
              left: oneOf(p.clients as { name: string } | { name: string }[] | null)?.name ?? "—",
              sub: p.payment_date,
              right: money(p.amount),
            }))}
          />
        </WidgetCard>
      );
    case "ultimos_pagos":
      return (
        <WidgetCard title="Últimos pagos">
          <MiniList
            empty="Sin pagos registrados."
            rows={recentSupplierPayments.map((p) => ({
              key: p.id,
              left: oneOf(p.suppliers as { name: string } | { name: string }[] | null)?.name ?? "—",
              sub: p.payment_date,
              right: money(p.amount),
            }))}
          />
        </WidgetCard>
      );
    case "tareas_pendientes":
      return (
        <WidgetCard title="Tareas pendientes">
          <MiniList
            empty="Sin tareas pendientes."
            rows={pendingTasks.map((t) => ({
              key: t.id,
              left: t.title,
              sub: t.due_date ?? undefined,
              right: t.priority ?? "",
            }))}
          />
        </WidgetCard>
      );
    case "rentabilidad_proyectos":
      return (
        <WidgetCard title="Rentabilidad por proyecto (top 5)">
          <MiniList
            empty="Sin proyectos facturados todavía."
            rows={topProjects.map((p) => ({
              key: p.id,
              left: `${p.number} — ${p.name}`,
              right: percent(p.margenReal),
            }))}
          />
        </WidgetCard>
      );
    default:
      return (
        <WidgetCard title={type}>
          <p className="text-sm text-brand-muted">Widget desconocido.</p>
        </WidgetCard>
      );
  }
}
