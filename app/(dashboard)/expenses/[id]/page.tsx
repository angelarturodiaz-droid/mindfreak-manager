import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getExpense,
  listExpenseCategories,
  listActiveSuppliers,
  listProjectsForSelect,
} from "@/features/expenses/queries";
import { cancelExpenseAction } from "@/features/expenses/actions";
import { hasPermission } from "@/lib/auth/permissions";
import { ExpenseEditForm } from "./expense-edit-form";

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

export default async function ExpenseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let expense;
  try {
    expense = await getExpense(id);
  } catch {
    notFound();
  }
  if (!expense) notFound();

  const [categories, suppliers, projects, canEdit] = await Promise.all([
    listExpenseCategories(),
    listActiveSuppliers(),
    listProjectsForSelect(),
    hasPermission("expenses.create"),
  ]);

  const category = expense.expense_categories as { name: string } | null;
  const supplier = expense.suppliers as { name: string } | null;
  const project = expense.projects as { number: string; name: string } | null;
  const bankAccount = expense.bank_accounts as
    | { name: string; bank_name: string | null }
    | null;

  const isEditable = canEdit && expense.status === "PENDING" && expense.paid_amount === 0;

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div>
        <Link href="/expenses" className="text-sm text-brand-muted hover:text-brand-text">
          ← Gastos
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-brand-primary">
              {expense.description}
            </h1>
            <p className="text-sm text-brand-muted">
              {expense.expense_date}
              {category && ` · ${category.name}`}
              {supplier && ` · ${supplier.name}`}
              {project && ` · ${project.number} — ${project.name}`}
            </p>
          </div>
          <span className="text-sm font-medium text-brand-accent">
            {STATUS_LABELS[expense.status] ?? expense.status}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <div className="border border-brand-muted/20 px-4 py-3">
          <p className="text-xs text-brand-muted">Subtotal</p>
          <p className="font-medium">{formatMoney(expense.subtotal, expense.currency)}</p>
        </div>
        <div className="border border-brand-muted/20 px-4 py-3">
          <p className="text-xs text-brand-muted">Impuesto</p>
          <p className="font-medium">{formatMoney(expense.tax, expense.currency)}</p>
        </div>
        <div className="border border-brand-muted/20 px-4 py-3">
          <p className="text-xs text-brand-muted">Total</p>
          <p className="font-medium">{formatMoney(expense.total, expense.currency)}</p>
        </div>
        <div className="border border-brand-muted/20 px-4 py-3">
          <p className="text-xs text-brand-muted">Balance</p>
          <p className="font-medium">{formatMoney(expense.balance, expense.currency)}</p>
        </div>
        {expense.payment_method && (
          <div className="border border-brand-muted/20 px-4 py-3">
            <p className="text-xs text-brand-muted">Método de pago</p>
            <p className="font-medium">{expense.payment_method}</p>
          </div>
        )}
        {bankAccount && (
          <div className="border border-brand-muted/20 px-4 py-3">
            <p className="text-xs text-brand-muted">Cuenta</p>
            <p className="font-medium">{bankAccount.name}</p>
          </div>
        )}
      </div>

      {canEdit && expense.status !== "CANCELLED" && (
        <form action={cancelExpenseAction.bind(null, expense.id)}>
          <button
            type="submit"
            className="border border-brand-muted/30 px-4 py-2 text-sm text-brand-muted hover:border-brand-danger hover:text-brand-danger"
          >
            Cancelar gasto
          </button>
        </form>
      )}

      {isEditable ? (
        <div>
          <h2 className="mb-3 text-sm font-medium text-brand-text">Editar gasto</h2>
          <ExpenseEditForm
            expense={expense}
            categories={categories}
            suppliers={suppliers}
            projects={projects}
          />
        </div>
      ) : (
        expense.status !== "CANCELLED" && (
          <p className="text-sm text-brand-muted">
            Este gasto ya no se puede editar (tiene pagos registrados o no está
            pendiente).
          </p>
        )
      )}
    </main>
  );
}
