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
  ListChecks,
  Wallet,
  DollarSign,
} from "lucide-react";
import { KpiCard, Card } from "@/components/ui/card";
import { FinancialFlowChart } from "@/app/(dashboard)/dashboard/financial-flow-chart";
import type { DashboardWidgetBundle } from "@/features/dashboard-widgets/bundle";

function money(amount: number) {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP" }).format(amount);
}

function moneyIn(amount: number, currency: string) {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency }).format(amount);
}

/** "Ahorros RD$X · Corriente RD$Y" (solo lo que tenga saldo). */
function cashBreakdown(c: { savings: number; checking: number; other: number; count: number }, currency: string) {
  if (c.count === 0) return `Sin cuentas en ${currency === "USD" ? "dólares" : "pesos"}`;
  const parts: string[] = [];
  if (c.savings !== 0) parts.push(`Ahorros ${moneyIn(c.savings, currency)}`);
  if (c.checking !== 0) parts.push(`Corriente ${moneyIn(c.checking, currency)}`);
  if (c.other !== 0) parts.push(`Sin tipo ${moneyIn(c.other, currency)}`);
  return parts.length ? parts.join(" · ") : `${c.count} cuenta${c.count === 1 ? "" : "s"}`;
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
    <ul className="flex flex-col divide-y divide-brand-border">
      {rows.map((r) => (
        <li
          key={r.key}
          className="flex items-center justify-between gap-3 py-2 text-sm first:pt-0 last:pb-0"
        >
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
function WidgetCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="flex h-full flex-col gap-3">
      <h3 className="flex items-center gap-2 text-sm font-medium text-brand-text">
        {icon && <span className="text-brand-accent">{icon}</span>}
        {title}
      </h3>
      {children}
    </Card>
  );
}

export function renderWidget(type: string, data: DashboardWidgetBundle): React.ReactNode {
  const { kpis, flow, receivables, recentPayments, recentSupplierPayments, pendingTasks, topProjects, bankCash } = data;

  switch (type) {
    case "disponible_bancos_dop":
      return (
        <Link href="/banks">
          <KpiCard
            label="Disponible en bancos (pesos)"
            value={moneyIn(bankCash.dop.total, "DOP")}
            danger={bankCash.dop.total < 0}
            hint={cashBreakdown(bankCash.dop, "DOP")}
            icon={<Wallet size={16} />}
          />
        </Link>
      );
    case "disponible_bancos_usd":
      return (
        <Link href="/banks">
          <KpiCard
            label="Disponible en bancos (dólares)"
            value={moneyIn(bankCash.usd.total, "USD")}
            danger={bankCash.usd.total < 0}
            hint={cashBreakdown(bankCash.usd, "USD")}
            icon={<DollarSign size={16} />}
          />
        </Link>
      );
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
        <WidgetCard title="Flujo financiero (últimos 6 meses)" icon={<TrendingUp size={15} />}>
          <FinancialFlowChart data={flow} />
        </WidgetCard>
      );
    case "facturas_vencidas":
      return (
        <WidgetCard
          title={`Facturas vencidas (${receivables.facturasVencidas.length})`}
          icon={<AlertTriangle size={15} />}
        >
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
        <WidgetCard title="Facturas próximas a vencer" icon={<Clock size={15} />}>
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
        <WidgetCard title="Últimos cobros" icon={<ArrowDownCircle size={15} />}>
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
        <WidgetCard title="Últimos pagos" icon={<ArrowUpCircle size={15} />}>
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
        <WidgetCard title="Tareas pendientes" icon={<ListChecks size={15} />}>
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
        <WidgetCard title="Rentabilidad por proyecto (top 5)" icon={<FolderKanban size={15} />}>
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
