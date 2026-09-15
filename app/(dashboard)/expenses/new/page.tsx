import {
  listExpenseCategories,
  listActiveSuppliers,
  listProjectsForSelect,
  listActiveAccountsForSelect,
} from "@/features/expenses/queries";
import { listBankCatalog } from "@/features/bank-catalog/queries";
import { NewExpenseForm } from "./new-expense-form";

export default async function NewExpensePage() {
  const [categories, suppliers, projects, accounts, bankCatalog] = await Promise.all([
    listExpenseCategories(),
    listActiveSuppliers(),
    listProjectsForSelect(),
    listActiveAccountsForSelect(),
    listBankCatalog(),
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
      <NewExpenseForm
        categories={categories}
        suppliers={suppliers}
        projects={projects}
        accounts={accounts}
        bankCatalog={bankCatalog}
      />
    </main>
  );
}
