import {
  listExpenseCategories,
  listActiveSuppliers,
  listProjectsForSelect,
} from "@/features/expenses/queries";
import { NewExpenseForm } from "./new-expense-form";

export default async function NewExpensePage() {
  const [categories, suppliers, projects] = await Promise.all([
    listExpenseCategories(),
    listActiveSuppliers(),
    listProjectsForSelect(),
  ]);

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div>
        <h1 className="text-xl font-semibold text-brand-primary">Nuevo gasto</h1>
        <p className="text-sm text-brand-muted">
          Puede ser de un proyecto/evento específico o un gasto general de la
          empresa.
        </p>
      </div>
      <NewExpenseForm categories={categories} suppliers={suppliers} projects={projects} />
    </main>
  );
}
