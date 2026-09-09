import Link from "next/link";
import { listAllPayments, listAllSupplierPayments } from "@/features/payments/queries";
import { PAYMENT_METHOD_LABELS } from "@/features/payments/schema";

function formatMoney(amount: number) {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP" }).format(
    amount,
  );
}

export default async function PaymentsPage() {
  const [payments, supplierPayments] = await Promise.all([
    listAllPayments(),
    listAllSupplierPayments(),
  ]);

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div>
        <h1 className="text-xl font-semibold text-brand-primary">
          Cobros y pagos
        </h1>
        <p className="text-sm text-brand-muted">
          Historial de cobros y pagos a proveedores registrados. Para
          registrar uno nuevo, ve a la factura o al gasto correspondiente.
        </p>
      </div>

      <h2 className="text-lg font-semibold text-brand-primary">Cobros</h2>

      {payments.length === 0 ? (
        <div className="border border-dashed border-brand-muted/30 p-8 text-center">
          <p className="text-sm text-brand-muted">
            Aún no se ha registrado ningún cobro.
          </p>
        </div>
      ) : (
        <table className="w-full max-w-3xl border-collapse text-sm">
          <thead>
            <tr className="border-b border-brand-muted/30 text-left text-brand-muted">
              <th className="py-2 font-medium">Fecha</th>
              <th className="py-2 font-medium">Factura</th>
              <th className="py-2 font-medium">Cliente</th>
              <th className="py-2 font-medium">Monto</th>
              <th className="py-2 font-medium">Método</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => {
              const invoiceData = p.invoices as { number: string }[] | { number: string } | null;
              const invoiceNumber = Array.isArray(invoiceData)
                ? invoiceData[0]?.number
                : invoiceData?.number;
              const clientData = p.clients as { name: string }[] | { name: string } | null;
              const clientName = Array.isArray(clientData)
                ? clientData[0]?.name
                : clientData?.name;
              return (
                <tr key={p.id} className="border-b border-brand-muted/10">
                  <td className="py-2">{p.payment_date}</td>
                  <td className="py-2">
                    <Link
                      href={`/invoices/${p.invoice_id}`}
                      className="text-brand-accent hover:underline"
                    >
                      {invoiceNumber ?? "—"}
                    </Link>
                  </td>
                  <td className="py-2 text-brand-muted">{clientName ?? "—"}</td>
                  <td className="py-2 font-medium">{formatMoney(p.amount)}</td>
                  <td className="py-2 text-brand-muted">
                    {PAYMENT_METHOD_LABELS[p.method] ?? p.method}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <div>
        <h2 className="text-lg font-semibold text-brand-primary">
          Pagos a proveedores
        </h2>
        <p className="text-sm text-brand-muted">
          Historial de pagos registrados. Para registrar uno nuevo, ve al
          gasto correspondiente.
        </p>
      </div>

      {supplierPayments.length === 0 ? (
        <div className="border border-dashed border-brand-muted/30 p-8 text-center">
          <p className="text-sm text-brand-muted">
            Aún no se ha registrado ningún pago a proveedor.
          </p>
        </div>
      ) : (
        <table className="w-full max-w-3xl border-collapse text-sm">
          <thead>
            <tr className="border-b border-brand-muted/30 text-left text-brand-muted">
              <th className="py-2 font-medium">Fecha</th>
              <th className="py-2 font-medium">Gasto</th>
              <th className="py-2 font-medium">Proveedor</th>
              <th className="py-2 font-medium">Monto</th>
              <th className="py-2 font-medium">Método</th>
            </tr>
          </thead>
          <tbody>
            {supplierPayments.map((p) => {
              const expenseData = p.expenses as
                | { description: string }[]
                | { description: string }
                | null;
              const expenseDescription = Array.isArray(expenseData)
                ? expenseData[0]?.description
                : expenseData?.description;
              const supplierData = p.suppliers as
                | { name: string }[]
                | { name: string }
                | null;
              const supplierName = Array.isArray(supplierData)
                ? supplierData[0]?.name
                : supplierData?.name;
              return (
                <tr key={p.id} className="border-b border-brand-muted/10">
                  <td className="py-2">{p.payment_date}</td>
                  <td className="py-2">
                    <Link
                      href={`/expenses/${p.expense_id}`}
                      className="text-brand-accent hover:underline"
                    >
                      {expenseDescription ?? "—"}
                    </Link>
                  </td>
                  <td className="py-2 text-brand-muted">{supplierName ?? "—"}</td>
                  <td className="py-2 font-medium">{formatMoney(p.amount)}</td>
                  <td className="py-2 text-brand-muted">
                    {PAYMENT_METHOD_LABELS[p.method] ?? p.method}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </main>
  );
}
