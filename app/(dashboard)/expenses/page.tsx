import Link from "next/link";
import { listExpenses } from "@/features/expenses/queries";
import { EXPENSE_STATUSES } from "@/features/expenses/schema";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  PARTIALLY_PAID: "Pago parcial",
  PAID: "Pagado",
  CANCELLED: "Cancelado",
};

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency }).format(
    amount,
  );
}

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const expenses = await listExpenses(params.status);

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-brand-primary">Gastos</h1>
          <p className="text-sm text-brand-muted">
            De un proyecto/evento específico o de la empresa en general.
          </p>
        </div>
        <Link
          href="/expenses/new"
          className="bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Nuevo gasto
        </Link>
      </div>

      <form className="flex gap-2" action="/expenses" method="get">
        <select
          name="status"
          defaultValue={params.status ?? ""}
          className="border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        >
          <option value="">Todos los estados</option>
          {EXPENSE_STATUSES.map((s) => (
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

      {expenses.length === 0 ? (
        <div className="border border-dashed border-brand-muted/30 p-8 text-center">
          <p className="text-sm text-brand-muted">
            Aún no tienes gastos que coincidan con este filtro.
          </p>
          <Link
            href="/expenses/new"
            className="mt-2 inline-block text-sm text-brand-accent hover:underline"
          >
            Crear el primero
          </Link>
        </div>
      ) : (
        <table className="w-full max-w-5xl border-collapse text-sm">
          <thead>
            <tr className="border-b border-brand-muted/30 text-left text-brand-muted">
              <th className="py-2 font-medium">Fecha</th>
              <th className="py-2 font-medium">Descripción</th>
              <th className="py-2 font-medium">Categoría</th>
              <th className="py-2 font-medium">Proveedor</th>
              <th className="py-2 font-medium">Proyecto</th>
              <th className="py-2 font-medium">Total</th>
              <th className="py-2 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((e) => {
              const category = e.expense_categories as { name: string }[] | null;
              const supplier = e.suppliers as { name: string }[] | null;
              const project = e.projects as { number: string; name: string }[] | null;
              return (
                <tr key={e.id} className="border-b border-brand-muted/10">
                  <td className="py-3 text-brand-muted">{e.expense_date}</td>
                  <td className="py-3">
                    <Link
                      href={`/expenses/${e.id}`}
                      className="font-medium text-brand-text hover:text-brand-accent"
                    >
                      {e.description}
                    </Link>
                  </td>
                  <td className="py-3 text-brand-muted">
                    {category?.[0]?.name ?? "—"}
                  </td>
                  <td className="py-3 text-brand-muted">
                    {supplier?.[0]?.name ?? "—"}
                  </td>
                  <td className="py-3 text-brand-muted">
                    {project?.[0] ? `${project[0].number}` : "—"}
                  </td>
                  <td className="py-3">{formatMoney(e.total, e.currency)}</td>
                  <td className="py-3 text-brand-accent">
                    {STATUS_LABELS[e.status] ?? e.status}
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
