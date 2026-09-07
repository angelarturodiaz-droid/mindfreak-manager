import Link from "next/link";
import { listQuotations } from "@/features/quotations/queries";
import { QUOTATION_STATUSES } from "@/features/quotations/schema";

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency }).format(
    amount,
  );
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  SENT: "Enviada",
  VIEWED: "Vista",
  NEGOTIATING: "Negociando",
  APPROVED: "Aprobada",
  REJECTED: "Rechazada",
  EXPIRED: "Expirada",
  CANCELLED: "Cancelada",
};

export default async function QuotationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const quotations = await listQuotations(params.status);

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-brand-primary">
            Cotizaciones
          </h1>
          <p className="text-sm text-brand-muted">
            Cotiza a clientes activos o potenciales (leads).
          </p>
        </div>
        <Link
          href="/quotations/new"
          className="bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Nueva cotización
        </Link>
      </div>

      <form className="flex gap-2" action="/quotations" method="get">
        <select
          name="status"
          defaultValue={params.status ?? ""}
          className="border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        >
          <option value="">Todos los estados</option>
          {QUOTATION_STATUSES.map((s) => (
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

      {quotations.length === 0 ? (
        <div className="border border-dashed border-brand-muted/30 p-8 text-center">
          <p className="text-sm text-brand-muted">
            Aún no tienes cotizaciones que coincidan con este filtro.
          </p>
          <Link
            href="/quotations/new"
            className="mt-2 inline-block text-sm text-brand-accent hover:underline"
          >
            Crear la primera
          </Link>
        </div>
      ) : (
        <table className="w-full max-w-3xl border-collapse text-sm">
          <thead>
            <tr className="border-b border-brand-muted/30 text-left text-brand-muted">
              <th className="py-2 font-medium">Número</th>
              <th className="py-2 font-medium">Cliente</th>
              <th className="py-2 font-medium">Fecha</th>
              <th className="py-2 font-medium">Total</th>
              <th className="py-2 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {quotations.map((q) => (
              <tr key={q.id} className="border-b border-brand-muted/10">
                <td className="py-3">
                  <Link
                    href={`/quotations/${q.id}`}
                    className="font-medium text-brand-text hover:text-brand-accent"
                  >
                    {q.number}
                  </Link>
                </td>
                <td className="py-3 text-brand-muted">
                  {(q.clients as { name: string }[] | null)?.[0]?.name ?? "—"}
                </td>
                <td className="py-3 text-brand-muted">{q.issue_date}</td>
                <td className="py-3">{formatMoney(q.total, q.currency)}</td>
                <td className="py-3 text-brand-accent">
                  {STATUS_LABELS[q.status] ?? q.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
