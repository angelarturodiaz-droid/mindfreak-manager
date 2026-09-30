import { listExpenseCategoriesWithUsage } from "@/features/expense-categories/queries";
import { NewExpenseCategoryForm } from "./new-expense-category-form";
import { DeleteExpenseCategoryButton } from "./delete-expense-category-button";
import { ImportCategoriesForm } from "./import-categories-form";
import { Card } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import Link from "next/link";
import { LiveSearchInput } from "@/components/ui/live-search-input";
import { Pagination } from "@/components/ui/pagination";
import { PAGE_SIZE, parsePage } from "@/lib/utils/pagination";
import { normalizeCatalogName } from "@/features/supplier-service-types/classification";

type CategoryRow = Awaited<ReturnType<typeof listExpenseCategoriesWithUsage>>[number];

export default async function ExpenseCategoriesSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const search = (params.q ?? "").trim();
  const all = await listExpenseCategoriesWithUsage();

  // Búsqueda (sin importar mayúsculas ni acentos) y páginas de 25, igual que
  // los demás listados, para no tener que bajar tanto.
  const needle = normalizeCatalogName(search);
  const filtered = needle
    ? all.filter(
        (c) =>
          normalizeCatalogName(c.name).includes(needle) ||
          normalizeCatalogName(c.description ?? "").includes(needle),
      )
    : all;
  const total = filtered.length;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(parsePage(params.page), lastPage);
  const categories = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const columns: Column<CategoryRow>[] = [
    { header: "Nombre", accessor: (c) => <span className="font-medium text-brand-text">{c.name}</span> },
    { header: "Descripción", accessor: (c) => <span className="text-brand-muted">{c.description ?? "—"}</span> },
    { header: "Gastos", className: "text-right", accessor: (c) => <span className="tabular-nums text-brand-muted">{c.expenseCount}</span> },
    {
      header: "Mov. banco",
      className: "text-right",
      accessor: (c) => <span className="tabular-nums text-brand-muted">{c.transactionCount}</span>,
    },
    {
      header: "",
      className: "text-right",
      accessor: (c) => (
        <DeleteExpenseCategoryButton
          categoryId={c.id}
          categoryName={c.name}
          expenseCount={c.expenseCount + c.transactionCount}
        />
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-brand-primary">
          Categorías de gastos y movimientos
        </h2>
        <p className="text-sm text-brand-muted">
          Una sola lista para los gastos y para los ingresos y egresos de Bancos. Ej. Nómina,
          Alquiler, Cobro de factura, Pago a suplidor.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <p className="mb-3 text-sm font-semibold text-brand-text">Nueva categoría</p>
          <NewExpenseCategoryForm />
        </Card>
        <Card>
          <p className="mb-3 text-sm font-semibold text-brand-text">Importar varias desde CSV</p>
          <ImportCategoriesForm />
        </Card>
      </div>

      <section className="flex max-w-4xl flex-col gap-3">
        <form action="/settings/expense-categories" method="get" className="flex flex-wrap items-center gap-2">
          <LiveSearchInput defaultValue={search} placeholder="Buscar categoría…" ariaLabel="Buscar categoría por nombre o descripción" />
          {search && (
            <Link href="/settings/expense-categories" className="px-2 text-sm text-brand-accent hover:underline">
              Limpiar
            </Link>
          )}
          <span className="ml-auto text-sm text-brand-muted">
            {search ? `${total} de ${all.length} categorías` : `${all.length} categorías`}
          </span>
        </form>
        <DataTable
          columns={columns}
          rows={categories}
          keyFor={(c) => c.id}
          maxWidth="max-w-4xl"
          emptyMessage="Sin categorías todavía."
          filtered={Boolean(search)}
          clearHref="/settings/expense-categories"
          what="categorías"
        />
        <Pagination
          basePath="/settings/expense-categories"
          page={page}
          pageSize={PAGE_SIZE}
          total={total}
          params={{ q: search || undefined }}
        />
      </section>
    </div>
  );
}
