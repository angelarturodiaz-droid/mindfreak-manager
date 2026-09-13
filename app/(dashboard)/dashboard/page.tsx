import Link from "next/link";
import {
  TrendingUp,
  Wallet,
  CreditCard,
  Banknote,
  ArrowDownCircle,
  ArrowUpCircle,
  PiggyBank,
  Percent,
  FolderKanban,
  FileClock,
  FileCheck2,
  LogOut,
  Plus,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth/permissions";
import { signOut } from "@/features/auth/actions";
import { getDashboardKPIs, getFinancialFlowSeries } from "@/features/dashboard/queries";
import { FinancialFlowChart } from "./financial-flow-chart";
import { KpiCard } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function formatMoney(amount: number) {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP" }).format(
    amount,
  );
}

function formatPercent(value: number | null) {
  if (value === null) return "—";
  return `${value.toFixed(1)}%`;
}

const QUICK_ACTIONS = [
  { href: "/quotations/new", label: "Nueva cotización" },
  { href: "/clients/new", label: "Nuevo cliente" },
  { href: "/invoices/new", label: "Nueva factura" },
  { href: "/expenses/new", label: "Nuevo gasto" },
];

export default async function DashboardPage() {
  const [user, kpis, flow] = await Promise.all([
    getCurrentUser(),
    getDashboardKPIs(),
    getFinancialFlowSeries(6),
  ]);

  return (
    <main className="flex flex-1 flex-col gap-8 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-brand-primary">Dashboard</h1>
          <p className="text-sm text-brand-muted">
            Sesión activa: {user?.email ?? "—"}
          </p>
        </div>
        <form action={signOut}>
          <Button type="submit" variant="outline" size="sm" icon={<LogOut size={14} />}>
            Cerrar sesión
          </Button>
        </form>
      </div>

      <section className="flex flex-wrap gap-2">
        {QUICK_ACTIONS.map((action) => (
          <Link key={action.href} href={action.href}>
            <Button variant="outline" size="sm" icon={<Plus size={14} />}>
              {action.label}
            </Button>
          </Link>
        ))}
      </section>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <KpiCard label="Ventas (mes)" value={formatMoney(kpis.ventas)} icon={<TrendingUp size={16} />} />
        <KpiCard label="Cobros (mes)" value={formatMoney(kpis.cobros)} icon={<Wallet size={16} />} />
        <KpiCard label="Gastos (mes)" value={formatMoney(kpis.gastos)} icon={<CreditCard size={16} />} />
        <KpiCard label="Pagos (mes)" value={formatMoney(kpis.pagos)} icon={<Banknote size={16} />} />
        <KpiCard
          label="Cuentas por cobrar"
          value={formatMoney(kpis.cuentasPorCobrar)}
          icon={<ArrowDownCircle size={16} />}
        />
        <KpiCard
          label="Cuentas por pagar"
          value={formatMoney(kpis.cuentasPorPagar)}
          icon={<ArrowUpCircle size={16} />}
        />
        <KpiCard
          label="Utilidad (mes)"
          value={formatMoney(kpis.utilidad)}
          danger={kpis.utilidad < 0}
          icon={<PiggyBank size={16} />}
        />
        <KpiCard label="Margen (mes)" value={formatPercent(kpis.margen)} icon={<Percent size={16} />} />
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link href="/projects">
          <KpiCard
            label="Proyectos activos"
            value={String(kpis.proyectosActivos)}
            icon={<FolderKanban size={16} />}
          />
        </Link>
        <Link href="/quotations">
          <KpiCard
            label="Cotizaciones pendientes"
            value={String(kpis.cotizacionesPendientes)}
            icon={<FileClock size={16} />}
          />
        </Link>
        <Link href="/quotations">
          <KpiCard
            label="Cotizaciones aprobadas"
            value={String(kpis.cotizacionesAprobadas)}
            icon={<FileCheck2 size={16} />}
          />
        </Link>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-brand-text">
          Flujo financiero (últimos 6 meses)
        </h2>
        <FinancialFlowChart data={flow} />
      </section>
    </main>
  );
}
