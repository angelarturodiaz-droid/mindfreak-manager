import { listExpenseCategoriesWithUsage } from "@/features/expense-categories/queries";
import { NewExpenseCategoryForm } from "./new-expense-category-form";
import { DeleteExpenseCategoryButton } from "./delete-expense-category-button";

export default async function ExpenseCategoriesSettingsPage() {
  const categories = await listExpenseCategoriesWithUsage();

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

      <table className="w-full max-w-2xl border-collapse text-sm">
        <thead>
          <tr className="border-b border-brand-muted/30 text-left text-brand-muted">
            <th className="py-2 font-medium">Nombre</th>
            <th className="py-2 font-medium">Descripción</th>
            <th className="py-2 font-medium">Gastos</th>
            <th className="py-2 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {categories.map((c) => (
            <tr key={c.id} className="border-b border-brand-muted/10">
              <td className="py-2">{c.name}</td>
              <td className="py-2 text-brand-muted">{c.description ?? "—"}</td>
              <td className="py-2 text-brand-muted">{c.expenseCount}</td>
              <td className="py-2 text-right">
                <DeleteExpenseCategoryButton
                  categoryId={c.id}
                  categoryName={c.name}
                  expenseCount={c.expenseCount}
                />
              </td>
            </tr>
          ))}
          {categories.length === 0 && (
            <tr>
              <td colSpan={4} className="py-4 text-center text-brand-muted">
                Sin categorías todavía.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <section className="max-w-2xl">
        <h2 className="mb-3 text-sm font-medium text-brand-text">
          Nueva categoría
        </h2>
        <NewExpenseCategoryForm />
      </section>
    </div>
  );
}
