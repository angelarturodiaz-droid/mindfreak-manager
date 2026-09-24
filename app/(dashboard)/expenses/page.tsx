import Link from "next/link";
import { CreditCard, Plus } from "lucide-react";
import { listExpenses } from "@/features/expenses/queries";
import { EXPENSE_STATUSES } from "@/features/expenses/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/field";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { relationName, relationRow } from "@/lib/utils/relation";

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

type ExpenseRow = Awaited<ReturnType<typeof listExpenses>>[number];

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const expenses = await listExpenses(params.status);

  const columns: Column<ExpenseRow>[] = [
    { header: "Fecha", accessor: (e) => <span className="text-brand-muted">{e.expense_date}</span> },
    {
      header: "Descripción",
      accessor: (e) => (
        <Link href={`/expenses/${e.id}`} className="font-medium text-brand-text hover:text-brand-accent">
          {e.description}
        </Link>
      ),
    },
    {
      header: "Categoría",
      accessor: (e) => {
        return <span className="text-brand-muted">{relationName(e.expense_categories) ?? "—"}</span>;
      },
    },
    {
      header: "Proveedor",
      accessor: (e) => {
        return <span className="text-brand-muted">{relationName(e.suppliers) ?? "—"}</span>;
      },
    },
    {
      header: "Proyecto",
      accessor: (e) => {
        const project = relationRow<{ number: string; name: string }>(e.projects);
        return <span className="text-brand-muted">{project?.number ?? "—"}</span>;
      },
    },
    { header: "Total", accessor: (e) => formatMoney(e.total, e.currency) },
    {
      header: "Estado",
      accessor: (e) => <Badge status={e.status}>{STATUS_LABELS[e.status] ?? e.status}</Badge>,
    },
  ];

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-brand-primary">Gastos</h1>
          <p className="text-sm text-brand-muted">
            De un proyecto/evento específico o de la empresa en general.
          </p>
        </div>
        <Link href="/expenses/new">
          <Button size="sm" icon={<Plus size={14} />}>
            Nuevo gasto
          </Button>
        </Link>
      </div>

      <form className="flex flex-wrap items-end gap-2" action="/expenses" method="get">
        <Select name="status" defaultValue={params.status ?? ""} className="w-48">
          <option value="">Todos los estados</option>
          {EXPENSE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="outline" size="md">
          Filtrar
        </Button>
      </form>

      {expenses.length === 0 ? (
        <EmptyState
          icon={<CreditCard size={28} />}
          title="Aún no tienes gastos que coincidan con este filtro."
          action={
            <Link href="/expenses/new">
              <Button size="sm" icon={<Plus size={14} />}>
                Crear el primero
              </Button>
            </Link>
          }
        />
      ) : (
        <DataTable columns={columns} rows={expenses} keyFor={(e) => e.id} maxWidth="max-w-5xl" />
      )}
    </main>
  );
}
