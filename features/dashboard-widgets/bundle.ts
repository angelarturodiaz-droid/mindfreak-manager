import { getDashboardKPIs, getFinancialFlowSeries } from "@/features/dashboard/queries";
import { getReceivablesDashboard, getProjectsProfitabilityReport } from "@/features/reports/queries";
import { listAllPayments, listAllSupplierPayments } from "@/features/payments/queries";
import { listTasks } from "@/features/tasks/queries";

/**
 * Se piden todas las fuentes de datos de una sola vez (en paralelo),
 * independientemente de qué widgets estén visibles — son las mismas
 * queries ya usadas en Dashboard/Reportes, así que no hay costo extra
 * real, y evita la complejidad de "pedir solo lo que se necesita" widget
 * por widget.
 */
export async function getDashboardWidgetBundle() {
  const [kpis, flow, receivables, recentPayments, recentSupplierPayments, pendingTasks, profitability] =
    await Promise.all([
      getDashboardKPIs(),
      getFinancialFlowSeries(6),
      getReceivablesDashboard(),
      listAllPayments(),
      listAllSupplierPayments(),
      listTasks({ status: "PENDING" }),
      getProjectsProfitabilityReport(),
    ]);

  return {
    kpis,
    flow,
    receivables,
    recentPayments: recentPayments.slice(0, 5),
    recentSupplierPayments: recentSupplierPayments.slice(0, 5),
    pendingTasks: pendingTasks.slice(0, 5),
    topProjects: [...profitability]
      .sort((a, b) => (b.margenReal ?? -Infinity) - (a.margenReal ?? -Infinity))
      .slice(0, 5),
  };
}

export type DashboardWidgetBundle = Awaited<ReturnType<typeof getDashboardWidgetBundle>>;
