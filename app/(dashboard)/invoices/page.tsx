import Link from "next/link";
import { listInvoices } from "@/features/invoices/queries";
import { INVOICE_STATUSES } from "@/features/invoices/schema";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  ISSUED: "Emitida",
  PARTIALLY_PAID: "Pago parcial",
  PAID: "Pagada",
  OVERDUE: "Vencida",
  CANCELLED: "Cancelada",
};

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency }).format(
    amount,
  );
}

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const invoices = await listInvoices(params.status);

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-brand-primary">Facturas</h1>
          <p className="text-sm text-brand-muted">
            Ligadas a un cliente y, opcionalmente, a un proyecto/evento.
          </p>
        </div>
        <Link
          href="/invoices/new"
          className="bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Nueva factura
        </Link>
      </div>

      <form className="flex gap-2" action="/invoices" method="get">
        <select
          name="status"
          defaultValue={params.status ?? ""}
          className="border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        >
          <option value="">Todos los estados</option>
          {INVOICE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="border border-brand-muted/30 px-4 py-2 text-sm text-brand-text hover:border-brand-accent"
        >
          Filtrar
        </button>
      </form>

      {invoices.length === 0 ? (
        <div className="border border-dashed border-brand-muted/30 p-8 text-center">
          <p className="text-sm text-brand-muted">
            Aún no tienes facturas que coincidan con este filtro.
          </p>
          <Link
            href="/invoices/new"
            className="mt-2 inline-block text-sm text-brand-accent hover:underline"
          >
            Crear la primera
          </Link>
        </div>
      ) : (
        <table className="w-full max-w-4xl border-collapse text-sm">
          <thead>
            <tr className="border-b border-brand-muted/30 text-left text-brand-muted">
              <th className="py-2 font-medium">Número</th>
              <th className="py-2 font-medium">Cliente</th>
              <th className="py-2 font-medium">Vence</th>
              <th className="py-2 font-medium">Total</th>
              <th className="py-2 font-medium">Balance</th>
              <th className="py-2 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id} className="border-b border-brand-muted/10">
                <td className="py-3">
                  <Link
                    href={`/invoices/${inv.id}`}
                    className="font-medium text-brand-text hover:text-brand-accent"
                  >
                    {inv.number}
                  </Link>
                </td>
                <td className="py-3 text-brand-muted">
                  {(inv.clients as { name: string }[] | null)?.[0]?.name ?? "—"}
                </td>
                <td className="py-3 text-brand-muted">{inv.due_date || "—"}</td>
                <td className="py-3">{formatMoney(inv.total, inv.currency)}</td>
                <td className="py-3">{formatMoney(inv.balance, inv.currency)}</td>
                <td className="py-3 text-brand-accent">
                  {STATUS_LABELS[inv.status] ?? inv.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
