import { listExpenseCategoriesWithUsage } from "@/features/expense-categories/queries";
import { NewExpenseCategoryForm } from "./new-expense-category-form";
import { DeleteExpenseCategoryButton } from "./delete-expense-category-button";
import { ImportCategoriesForm } from "./import-categories-form";
import { Card } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";

type CategoryRow = Awaited<ReturnType<typeof listExpenseCategoriesWithUsage>>[number];

export default async function ExpenseCategoriesSettingsPage() {
  const categories = await listExpenseCategoriesWithUsage();

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

      <DataTable
        columns={columns}
        rows={categories}
        keyFor={(c) => c.id}
        maxWidth="max-w-4xl"
        emptyMessage="Sin categorías todavía."
      />
    </div>
  );
}
