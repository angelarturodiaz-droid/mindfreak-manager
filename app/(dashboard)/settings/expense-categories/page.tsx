import { listExpenseCategoriesWithUsage } from "@/features/expense-categories/queries";
import { NewExpenseCategoryForm } from "./new-expense-category-form";
import { DeleteExpenseCategoryButton } from "./delete-expense-category-button";
import { DataTable, type Column } from "@/components/ui/data-table";

type CategoryRow = Awaited<ReturnType<typeof listExpenseCategoriesWithUsage>>[number];

export default async function ExpenseCategoriesSettingsPage() {
  const categories = await listExpenseCategoriesWithUsage();

  const columns: Column<CategoryRow>[] = [
    { header: "Nombre", accessor: (c) => c.name },
    { header: "Descripción", accessor: (c) => <span className="text-brand-muted">{c.description ?? "—"}</span> },
    { header: "Gastos", accessor: (c) => <span className="text-brand-muted">{c.expenseCount}</span> },
    {
      header: "",
      className: "text-right",
      accessor: (c) => (
        <DeleteExpenseCategoryButton categoryId={c.id} categoryName={c.name} expenseCount={c.expenseCount} />
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-brand-primary">
          Categorías de gastos
        </h2>
        <p className="text-sm text-brand-muted">
          Ej. Catering, Transporte, Equipos, Personal. Se usan al registrar un
          gasto.
        </p>
      </div>

      <DataTable
        columns={columns}
        rows={categories}
        keyFor={(c) => c.id}
        maxWidth="max-w-2xl"
        emptyMessage="Sin categorías todavía."
      />

      <section className="max-w-2xl">
        <h2 className="mb-3 text-sm font-medium text-brand-text">
          Nueva categoría
        </h2>
        <NewExpenseCategoryForm />
      </section>
    </div>
  );
}
