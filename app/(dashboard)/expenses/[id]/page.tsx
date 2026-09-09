import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getExpense,
  listExpenseCategories,
  listActiveSuppliers,
  listProjectsForSelect,
} from "@/features/expenses/queries";
import { cancelExpenseAction } from "@/features/expenses/actions";
import { listPaymentsForExpense, listBankAccounts } from "@/features/payments/queries";
import { PAYMENT_METHOD_LABELS } from "@/features/payments/schema";
import { hasPermission } from "@/lib/auth/permissions";
import { ExpenseEditForm } from "./expense-edit-form";
import { RegisterSupplierPaymentForm } from "./register-supplier-payment-form";

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

  const [categories, suppliers, projects, canEdit, canPay, payments, bankAccounts] =
    await Promise.all([
      listExpenseCategories(),
      listActiveSuppliers(),
      listProjectsForSelect(),
      hasPermission("expenses.create"),
      hasPermission("payments.create"),
      listPaymentsForExpense(id),
      listBankAccounts(),
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

      {["PENDING", "PARTIALLY_PAID"].includes(expense.status) && canPay && (
        <div>
          <h2 className="mb-3 text-sm font-medium text-brand-text">Registrar pago</h2>
          {expense.supplier_id ? (
            <RegisterSupplierPaymentForm
              expenseId={expense.id}
              supplierId={expense.supplier_id}
              projectId={expense.project_id}
              balance={expense.balance}
              currency={expense.currency}
              bankAccounts={bankAccounts}
            />
          ) : (
            <p className="text-sm text-brand-muted">
              Este gasto no tiene proveedor asignado — agrégalo editando el
              gasto para poder registrarle un pago.
            </p>
          )}
        </div>
      )}

      {payments.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-medium text-brand-text">
            Historial de pagos
          </h2>
          <table className="w-full max-w-2xl border-collapse text-sm">
            <thead>
              <tr className="border-b border-brand-muted/30 text-left text-brand-muted">
                <th className="py-2 font-medium">Fecha</th>
                <th className="py-2 font-medium">Monto</th>
                <th className="py-2 font-medium">Método</th>
                <th className="py-2 font-medium">Referencia</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b border-brand-muted/10">
                  <td className="py-2">{p.payment_date}</td>
                  <td className="py-2">{formatMoney(p.amount, expense.currency)}</td>
                  <td className="py-2 text-brand-muted">
                    {PAYMENT_METHOD_LABELS[p.method] ?? p.method}
                  </td>
                  <td className="py-2 text-brand-muted">{p.reference ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
