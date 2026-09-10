import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/permissions";
import { signOut } from "@/features/auth/actions";
import { getDashboardKPIs, getFinancialFlowSeries } from "@/features/dashboard/queries";
import { FinancialFlowChart } from "./financial-flow-chart";

function formatMoney(amount: number) {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP" }).format(
    amount,
  );
}

function formatPercent(value: number | null) {
  if (value === null) return "—";
  return `${value.toFixed(1)}%`;
}

export default async function DashboardPage() {
  const [user, kpis, flow] = await Promise.all([
    getCurrentUser(),
    getDashboardKPIs(),
    getFinancialFlowSeries(6),
  ]);

  const kpiCards = [
    { label: "Ventas (mes)", value: formatMoney(kpis.ventas) },
    { label: "Cobros (mes)", value: formatMoney(kpis.cobros) },
    { label: "Gastos (mes)", value: formatMoney(kpis.gastos) },
    { label: "Pagos (mes)", value: formatMoney(kpis.pagos) },
    { label: "Cuentas por cobrar", value: formatMoney(kpis.cuentasPorCobrar) },
    { label: "Cuentas por pagar", value: formatMoney(kpis.cuentasPorPagar) },
    {
      label: "Utilidad (mes)",
      value: formatMoney(kpis.utilidad),
      danger: kpis.utilidad < 0,
    },
    { label: "Margen (mes)", value: formatPercent(kpis.margen) },
    { label: "Proyectos activos", value: String(kpis.proyectosActivos), link: "/projects" },
    {
      label: "Cotizaciones pendientes",
      value: String(kpis.cotizacionesPendientes),
      link: "/quotations",
    },
    {
      label: "Cotizaciones aprobadas",
      value: String(kpis.cotizacionesAprobadas),
      link: "/quotations",
    },
  ];

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
          <button
            type="submit"
            className="w-fit border border-brand-muted/30 px-4 py-2 text-sm text-brand-text hover:border-brand-accent"
          >
            Cerrar sesión
          </button>
        </form>
      </div>

      <section>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {kpiCards.map((kpi) => {
            const content = (
              <div className="border border-brand-muted/20 px-4 py-3">
                <p className="text-xs text-brand-muted">{kpi.label}</p>
                <p
                  className={
                    "danger" in kpi && kpi.danger
                      ? "text-lg font-semibold text-brand-danger"
                      : "text-lg font-semibold text-brand-primary"
                  }
                >
                  {kpi.value}
                </p>
              </div>
            );
            return "link" in kpi && kpi.link ? (
              <Link key={kpi.label} href={kpi.link} className="hover:border-brand-accent">
                {content}
              </Link>
            ) : (
              <div key={kpi.label}>{content}</div>
            );
          })}
        </div>
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

