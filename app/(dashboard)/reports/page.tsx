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

export default async function ReportsPage() {
  if (!(await hasPermission("reports.view"))) {
    redirect("/dashboard");
  }

  const [profitability, receivable, payable, salesByClient, expensesByCategory] =
    await Promise.all([
      getProjectsProfitabilityReport(),
      getAccountsReceivableReport(),
      getAccountsPayableReport(),
      getSalesByClientReport(),
      getExpensesByCategoryReport(),
    ]);

  return (
    <main className="flex flex-1 flex-col gap-10 p-8">
      <div>
        <h1 className="text-xl font-semibold text-brand-primary">Reportes</h1>
        <p className="text-sm text-brand-muted">
          Vistas de solo lectura sobre los datos ya registrados. Todos los
          montos se consolidan en la moneda base de la empresa.
        </p>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-brand-primary">
          Rentabilidad por proyecto
        </h2>
        {profitability.length === 0 ? (
          <p className="text-sm text-brand-muted">Sin proyectos todavía.</p>
        ) : (
          <table className="w-full max-w-5xl border-collapse text-sm">
            <thead>
              <tr className="border-b border-brand-muted/30 text-left text-brand-muted">
                <th className="py-2 font-medium">Proyecto</th>
                <th className="py-2 font-medium">Estado</th>
                <th className="py-2 font-medium">Cotizado</th>
                <th className="py-2 font-medium">Facturado</th>
                <th className="py-2 font-medium">Cobrado</th>
                <th className="py-2 font-medium">Costo real</th>
                <th className="py-2 font-medium">Utilidad real</th>
                <th className="py-2 font-medium">Margen</th>
              </tr>
            </thead>
            <tbody>
              {profitability.map((p) => (
                <tr key={p.id} className="border-b border-brand-muted/10">
                  <td className="py-2">
                    {p.number} — {p.name}
                  </td>
                  <td className="py-2 text-brand-muted">
                    {STATUS_LABELS[p.status] ?? p.status}
                  </td>
                  <td className="py-2">{formatMoney(p.cotizado)}</td>
                  <td className="py-2">{formatMoney(p.facturado)}</td>
                  <td className="py-2">{formatMoney(p.cobrado)}</td>
                  <td className="py-2">{formatMoney(p.costoReal)}</td>
                  <td
                    className={
                      p.utilidadReal < 0
                        ? "py-2 font-medium text-brand-danger"
                        : "py-2 font-medium"
                    }
                  >
                    {formatMoney(p.utilidadReal)}
                  </td>
                  <td className="py-2 text-brand-muted">{formatPercent(p.margenReal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-brand-primary">
          Cuentas por cobrar
        </h2>
        {receivable.length === 0 ? (
          <p className="text-sm text-brand-muted">No hay facturas pendientes de cobro.</p>
        ) : (
          <table className="w-full max-w-3xl border-collapse text-sm">
            <thead>
              <tr className="border-b border-brand-muted/30 text-left text-brand-muted">
                <th className="py-2 font-medium">Factura</th>
                <th className="py-2 font-medium">Cliente</th>
                <th className="py-2 font-medium">Vencimiento</th>
                <th className="py-2 font-medium">Días vencida</th>
                <th className="py-2 font-medium">Balance</th>
              </tr>
            </thead>
            <tbody>
              {receivable.map((inv) => {
                const clientData = inv.clients as { name: string }[] | { name: string } | null;
                const clientName = Array.isArray(clientData)
                  ? clientData[0]?.name
                  : clientData?.name;
                return (
                  <tr key={inv.id} className="border-b border-brand-muted/10">
                    <td className="py-2">{inv.number}</td>
                    <td className="py-2 text-brand-muted">{clientName ?? "—"}</td>
                    <td className="py-2 text-brand-muted">{inv.due_date ?? "—"}</td>
                    <td className="py-2">
                      {inv.daysOverdue > 0 ? (
                        <span className="text-brand-danger">{inv.daysOverdue} días</span>
                      ) : (
                        "Al día"
                      )}
                    </td>
                    <td className="py-2 font-medium">
                      {formatMoney(inv.balance, inv.currency)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-brand-primary">
          Cuentas por pagar
        </h2>
        {payable.length === 0 ? (
          <p className="text-sm text-brand-muted">No hay gastos pendientes de pago.</p>
        ) : (
          <table className="w-full max-w-3xl border-collapse text-sm">
            <thead>
              <tr className="border-b border-brand-muted/30 text-left text-brand-muted">
                <th className="py-2 font-medium">Gasto</th>
                <th className="py-2 font-medium">Proveedor</th>
                <th className="py-2 font-medium">Fecha</th>
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
                    <td className="py-2">{e.description}</td>
                    <td className="py-2 text-brand-muted">{supplierName ?? "—"}</td>
                    <td className="py-2 text-brand-muted">{e.expense_date}</td>
                    <td className="py-2 font-medium">{formatMoney(e.balance, e.currency)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-lg font-semibold text-brand-primary">
            Ventas por cliente
          </h2>
          {salesByClient.length === 0 ? (
            <p className="text-sm text-brand-muted">Sin facturación todavía.</p>
          ) : (
            <table className="w-full max-w-md border-collapse text-sm">
              <thead>
                <tr className="border-b border-brand-muted/30 text-left text-brand-muted">
                  <th className="py-2 font-medium">Cliente</th>
                  <th className="py-2 font-medium">Total facturado</th>
                </tr>
              </thead>
              <tbody>
                {salesByClient.map((c) => (
                  <tr key={c.clientId} className="border-b border-brand-muted/10">
                    <td className="py-2">{c.name}</td>
                    <td className="py-2 font-medium">{formatMoney(c.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-brand-primary">
            Gastos por categoría
          </h2>
          {expensesByCategory.length === 0 ? (
            <p className="text-sm text-brand-muted">Sin gastos todavía.</p>
          ) : (
            <table className="w-full max-w-md border-collapse text-sm">
              <thead>
                <tr className="border-b border-brand-muted/30 text-left text-brand-muted">
                  <th className="py-2 font-medium">Categoría</th>
                  <th className="py-2 font-medium">Total gastado</th>
                </tr>
              </thead>
              <tbody>
                {expensesByCategory.map((c) => (
                  <tr key={c.categoryId} className="border-b border-brand-muted/10">
                    <td className="py-2">{c.name}</td>
                    <td className="py-2 font-medium">{formatMoney(c.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </main>
  );
}
