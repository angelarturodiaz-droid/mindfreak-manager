import Link from "next/link";
import { CalendarRange, Clock, CreditCard, Plus, Receipt, Wallet } from "lucide-react";
import { listExpenses, getExpenseStats } from "@/features/expenses/queries";
import { EXPENSE_STATUSES } from "@/features/expenses/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { FilterPills, StatCard, StatGrid, listHref } from "@/components/ui/page-kit";
import { relationName, relationRow } from "@/lib/utils/relation";
import { parsePage } from "@/lib/utils/pagination";
import { formatDate } from "@/lib/utils/dates";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  PARTIALLY_PAID: "Pago parcial",
  PAID: "Pagado",
  CANCELLED: "Cancelado",
};

function formatMoney(amount: number, currency = "DOP") {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency }).format(
    amount,
  );
}

type ExpenseRow = Awaited<ReturnType<typeof listExpenses>>["rows"][number];

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = parsePage(params.page);
  const [{ rows: expenses, total, pageSize }, stats] = await Promise.all([
    listExpenses({ status: params.status, page }),
    getExpenseStats(),
  ]);
  const monthName = new Intl.DateTimeFormat("es-DO", {
    month: "long",
    timeZone: "America/Santo_Domingo",
  }).format(new Date());

  const columns: Column<ExpenseRow>[] = [
    {
      header: "Fecha",
      accessor: (e) => <span className="whitespace-nowrap text-brand-muted">{formatDate(e.expense_date)}</span>,
    },
    {
      header: "Gasto",
      accessor: (e) => {
        const category = relationName(e.expense_categories);
        return (
          <Link href={`/expenses/${e.id}`} className="group block min-w-[12rem]">
            <span className="block font-medium text-brand-text group-hover:text-brand-accent">{e.description}</span>
            <span className="text-xs text-brand-muted">{category ?? "Sin categoría"}</span>
          </Link>
        );
      },
    },
    {
      header: "Proveedor",
      accessor: (e) => <span className="text-brand-text">{relationName(e.suppliers) ?? <span className="text-brand-muted">—</span>}</span>,
    },
    {
      header: "Proyecto",
      accessor: (e) => {
        const project = relationRow<{ number: string; name: string }>(e.projects);
        return project ? (
          <span className="block">
            <span className="block text-brand-text">{project.number}</span>
            <span className="block max-w-[12rem] truncate text-xs text-brand-muted">{project.name}</span>
          </span>
        ) : (
          <span className="text-xs text-brand-muted">Empresa</span>
        );
      },
    },
    {
      header: "Total",
      className: "text-right",
      accessor: (e) => (
        <span className="whitespace-nowrap font-medium tabular-nums">{formatMoney(e.total, e.currency)}</span>
      ),
    },
    {
      header: "Por pagar",
      className: "text-right",
      accessor: (e) => {
        const open = (e.status === "PENDING" || e.status === "PARTIALLY_PAID") && e.balance > 0;
        return (
          <span className={`whitespace-nowrap tabular-nums ${open ? "font-medium text-brand-warning" : "text-brand-muted"}`}>
            {open ? formatMoney(e.balance, e.currency) : "—"}
          </span>
        );
      },
    },
    {
      header: "Estado",
      accessor: (e) => <Badge status={e.status}>{STATUS_LABELS[e.status] ?? e.status}</Badge>,
    },
  ];

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
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

      <StatGrid>
        <StatCard
          label="Por pagar"
          value={formatMoney(stats.porPagar)}
          valueTone={stats.porPagar > 0 ? "warning" : undefined}
          hint={`${stats.porPagarCount} ${stats.porPagarCount === 1 ? "gasto pendiente" : "gastos pendientes"}`}
          icon={<Clock size={20} />}
          tone="amber"
        />
        <StatCard
          label={`Gastado en ${monthName}`}
          value={formatMoney(stats.mes)}
          hint="Sin cancelados"
          icon={<Wallet size={20} />}
          tone="blue"
        />
        <StatCard
          label="Gastado en el año"
          value={formatMoney(stats.anio)}
          hint="Desde el 1 de enero"
          icon={<CalendarRange size={20} />}
          tone="violet"
        />
        <StatCard
          label="Gastos registrados"
          value={String(stats.total)}
          hint={`${stats.byStatus.PAID ?? 0} pagados`}
          icon={<Receipt size={20} />}
          tone="green"
        />
      </StatGrid>

      <section className="flex flex-col gap-4">
        <FilterPills
          label="Filtrar por estado"
          items={[undefined, ...EXPENSE_STATUSES].map((s) => ({
            key: s ?? "all",
            label: s ? STATUS_LABELS[s] ?? s : "Todos",
            count: s ? stats.byStatus[s] ?? 0 : stats.total,
            active: (params.status ?? undefined) === s,
            href: listHref("/expenses", { status: s }),
          }))}
        />

        {expenses.length === 0 ? (
          <EmptyState
            icon={<CreditCard size={28} />}
            title={params.status ? "No hay gastos con este estado." : "Aún no tienes gastos."}
            action={
              <Link href="/expenses/new">
                <Button size="sm" icon={<Plus size={14} />}>
                  Nuevo gasto
                </Button>
              </Link>
            }
          />
        ) : (
          <div className="flex flex-col gap-4">
            <DataTable columns={columns} rows={expenses} keyFor={(e) => e.id} maxWidth="max-w-none" />
            <Pagination
              basePath="/expenses"
              page={page}
              pageSize={pageSize}
              total={total}
              params={{ status: params.status }}
            />
          </div>
        )}
      </section>
    </main>
  );
}
