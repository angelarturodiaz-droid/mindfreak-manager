import Link from "next/link";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/auth/permissions";
import {
  getProjectsProfitabilityReport,
  getAccountsReceivableReport,
  getAccountsPayableReport,
  getSalesByClientReport,
  getExpensesByCategoryReport,
} from "@/features/reports/queries";

function formatMoney(amount: number, currency = "DOP") {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency }).format(amount);
}

function formatPercent(value: number | null) {
  if (value === null) return "—";
  return `${value.toFixed(1)}%`;
}

const STATUS_LABELS: Record<string, string> = {
  PLANNING: "Planificación",
  CONFIRMED: "Confirmado",
  IN_PROGRESS: "En curso",
  COMPLETED: "Completado",
  CANCELLED: "Cancelado",
};

// Catálogo de reportes disponibles, agrupados por categoría. Nuevos reportes
// se agregan aquí — no hay ni habrá otra fase de "Reportes" en el plan
// (F19 es la única, ver F0-Arquitectura sección 33); esto es simplemente el
// mismo módulo creciendo, como en QuickBooks/similares.
const REPORT_CATALOG: { category: string; reports: { key: string; label: string }[] }[] = [
  {
    category: "Proyectos",
    reports: [{ key: "rentabilidad", label: "Rentabilidad por proyecto" }],
  },
  {
    category: "Cobros",
    reports: [{ key: "cxc", label: "Cuentas por cobrar" }],
  },
  {
    category: "Pagos",
    reports: [{ key: "cxp", label: "Cuentas por pagar" }],
  },
  {
    category: "Ventas",
    reports: [{ key: "ventas-cliente", label: "Ventas por cliente" }],
  },
  {
    category: "Gastos",
    reports: [{ key: "gastos-categoria", label: "Gastos por categoría" }],
  },
];

const DEFAULT_REPORT = "rentabilidad";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ report?: string }>;
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
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-brand-muted">
                {group.category}
              </p>
              <div className="flex flex-col">
                {group.reports.map((r) => (
                  <Link
                    key={r.key}
                    href={`/reports?report=${r.key}`}
                    className={
                      activeReport === r.key
                        ? "border-l-2 border-brand-accent bg-brand-accent/10 px-2 py-1.5 text-sm font-medium text-brand-accent"
                        : "border-l-2 border-transparent px-2 py-1.5 text-sm text-brand-text hover:text-brand-accent"
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
        {activeReport === "rentabilidad" && <ProfitabilityReport />}
        {activeReport === "cxc" && <ReceivableReport />}
        {activeReport === "cxp" && <PayableReport />}
        {activeReport === "ventas-cliente" && <SalesByClientReport />}
        {activeReport === "gastos-categoria" && <ExpensesByCategoryReport />}
      </section>
    </main>
  );
}

async function ProfitabilityReport() {
  const profitability = await getProjectsProfitabilityReport();
  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold text-brand-primary">
        Rentabilidad por proyecto
      </h2>
      {profitability.length === 0 ? (
        <p className="text-sm text-brand-muted">Sin proyectos todavía.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-brand-muted/30 text-left text-brand-muted">
                <th className="py-2 pr-4 font-medium">Proyecto</th>
                <th className="py-2 pr-4 font-medium">Estado</th>
                <th className="py-2 pr-4 font-medium">Cotizado</th>
                <th className="py-2 pr-4 font-medium">Facturado</th>
                <th className="py-2 pr-4 font-medium">Cobrado</th>
                <th className="py-2 pr-4 font-medium">Costo real</th>
                <th className="py-2 pr-4 font-medium">Utilidad real</th>
                <th className="py-2 font-medium">Margen</th>
              </tr>
            </thead>
            <tbody>
              {profitability.map((p) => (
                <tr key={p.id} className="border-b border-brand-muted/10">
                  <td className="py-2 pr-4">
                    {p.number} — {p.name}
                  </td>
                  <td className="py-2 pr-4 text-brand-muted">
                    {STATUS_LABELS[p.status] ?? p.status}
                  </td>
                  <td className="py-2 pr-4">{formatMoney(p.cotizado)}</td>
                  <td className="py-2 pr-4">{formatMoney(p.facturado)}</td>
                  <td className="py-2 pr-4">{formatMoney(p.cobrado)}</td>
                  <td className="py-2 pr-4">{formatMoney(p.costoReal)}</td>
                  <td
                    className={
                      p.utilidadReal < 0
                        ? "py-2 pr-4 font-medium text-brand-danger"
                        : "py-2 pr-4 font-medium"
                    }
                  >
                    {formatMoney(p.utilidadReal)}
                  </td>
                  <td className="py-2 text-brand-muted">{formatPercent(p.margenReal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

async function ReceivableReport() {
  const receivable = await getAccountsReceivableReport();
  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold text-brand-primary">Cuentas por cobrar</h2>
      {receivable.length === 0 ? (
        <p className="text-sm text-brand-muted">No hay facturas pendientes de cobro.</p>
      ) : (
        <table className="w-full max-w-3xl border-collapse text-sm">
          <thead>
            <tr className="border-b border-brand-muted/30 text-left text-brand-muted">
              <th className="py-2 pr-4 font-medium">Factura</th>
              <th className="py-2 pr-4 font-medium">Cliente</th>
              <th className="py-2 pr-4 font-medium">Vencimiento</th>
              <th className="py-2 pr-4 font-medium">Días vencida</th>
              <th className="py-2 font-medium">Balance</th>
            </tr>
          </thead>
          <tbody>
            {receivable.map((inv) => {
              const clientData = inv.clients as { name: string }[] | { name: string } | null;
              const clientName = Array.isArray(clientData) ? clientData[0]?.name : clientData?.name;
              return (
                <tr key={inv.id} className="border-b border-brand-muted/10">
                  <td className="py-2 pr-4">{inv.number}</td>
                  <td className="py-2 pr-4 text-brand-muted">{clientName ?? "—"}</td>
                  <td className="py-2 pr-4 text-brand-muted">{inv.due_date ?? "—"}</td>
                  <td className="py-2 pr-4">
                    {inv.daysOverdue > 0 ? (
                      <span className="text-brand-danger">{inv.daysOverdue} días</span>
                    ) : (
                      "Al día"
                    )}
                  </td>
                  <td className="py-2 font-medium">{formatMoney(inv.balance, inv.currency)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

async function PayableReport() {
  const payable = await getAccountsPayableReport();
  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold text-brand-primary">Cuentas por pagar</h2>
      {payable.length === 0 ? (
        <p className="text-sm text-brand-muted">No hay gastos pendientes de pago.</p>
      ) : (
        <table className="w-full max-w-3xl border-collapse text-sm">
          <thead>
            <tr className="border-b border-brand-muted/30 text-left text-brand-muted">
              <th className="py-2 pr-4 font-medium">Gasto</th>
              <th className="py-2 pr-4 font-medium">Proveedor</th>
              <th className="py-2 pr-4 font-medium">Fecha</th>
              <th className="py-2 font-medium">Balance</th>
            </tr>
          </thead>
          <tbody>
            {payable.map((e) => {
              const supplierData = e.suppliers as { name: string }[] | { name: string } | null;
              const supplierName = Array.isArray(supplierData)
                ? supplierData[0]?.name
                : supplierData?.name;
              return (
                <tr key={e.id} className="border-b border-brand-muted/10">
                  <td className="py-2 pr-4">{e.description}</td>
                  <td className="py-2 pr-4 text-brand-muted">{supplierName ?? "—"}</td>
                  <td className="py-2 pr-4 text-brand-muted">{e.expense_date}</td>
                  <td className="py-2 font-medium">{formatMoney(e.balance, e.currency)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

async function SalesByClientReport() {
  const salesByClient = await getSalesByClientReport();
  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold text-brand-primary">Ventas por cliente</h2>
      {salesByClient.length === 0 ? (
        <p className="text-sm text-brand-muted">Sin facturación todavía.</p>
      ) : (
        <table className="w-full max-w-md border-collapse text-sm">
          <thead>
            <tr className="border-b border-brand-muted/30 text-left text-brand-muted">
              <th className="py-2 pr-4 font-medium">Cliente</th>
              <th className="py-2 font-medium">Total facturado</th>
            </tr>
          </thead>
          <tbody>
            {salesByClient.map((c) => (
              <tr key={c.clientId} className="border-b border-brand-muted/10">
                <td className="py-2 pr-4">{c.name}</td>
                <td className="py-2 font-medium">{formatMoney(c.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

async function ExpensesByCategoryReport() {
  const expensesByCategory = await getExpensesByCategoryReport();
  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold text-brand-primary">Gastos por categoría</h2>
      {expensesByCategory.length === 0 ? (
        <p className="text-sm text-brand-muted">Sin gastos todavía.</p>
      ) : (
        <table className="w-full max-w-md border-collapse text-sm">
          <thead>
            <tr className="border-b border-brand-muted/30 text-left text-brand-muted">
              <th className="py-2 pr-4 font-medium">Categoría</th>
              <th className="py-2 font-medium">Total gastado</th>
            </tr>
          </thead>
          <tbody>
            {expensesByCategory.map((c) => (
              <tr key={c.categoryId} className="border-b border-brand-muted/10">
                <td className="py-2 pr-4">{c.name}</td>
                <td className="py-2 font-medium">{formatMoney(c.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
