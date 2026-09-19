import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
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
import { DocumentList } from "@/components/documents/document-list";
import { UploadDocumentForm } from "@/components/documents/upload-document-form";
import { listDocuments } from "@/features/documents/queries";
import { listBankCatalog } from "@/features/bank-catalog/queries";
import { getCompany } from "@/features/settings/queries";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { DownloadReceiptButton } from "@/components/payments/download-receipt-button";
import { generateSupplierPaymentReceiptAction } from "@/features/payments/actions";

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

type PaymentRow = Awaited<ReturnType<typeof listPaymentsForExpense>>[number];

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

  const [categories, suppliers, projects, canEdit, canPay, payments, bankAccounts, documents, bankCatalog, company] =
    await Promise.all([
      listExpenseCategories(),
      listActiveSuppliers(),
      listProjectsForSelect(),
      hasPermission("expenses.create"),
      hasPermission("payments.create"),
      listPaymentsForExpense(id),
      listBankAccounts(),
      listDocuments("expense", id),
      listBankCatalog(),
      getCompany(),
    ]);

  const category = expense.expense_categories as { name: string } | null;
  const supplier = expense.suppliers as { name: string } | null;
  const project = expense.projects as { number: string; name: string } | null;
  const bankAccount = expense.bank_accounts as
    | { name: string; bank_name: string | null }
    | null;

  const isEditable = canEdit && expense.status === "PENDING" && expense.paid_amount === 0;

  const paymentColumns: Column<PaymentRow>[] = [
    { header: "Fecha", accessor: (p) => p.payment_date },
    { header: "Monto", accessor: (p) => <span className="font-medium">{formatMoney(p.amount, expense.currency)}</span> },
    { header: "Método", accessor: (p) => <span className="text-brand-muted">{PAYMENT_METHOD_LABELS[p.method] ?? p.method}</span> },
    {
      header: "Banco (propio)",
      accessor: (p) => {
        const account = p.bank_accounts as
          | { name: string; bank_name: string | null }
          | { name: string; bank_name: string | null }[]
          | null;
        const a = Array.isArray(account) ? account[0] : account;
        return <span className="text-brand-muted">{a ? `${a.name}${a.bank_name ? ` (${a.bank_name})` : ""}` : "—"}</span>;
      },
    },
    {
      header: "Banco del proveedor",
      accessor: (p) => <span className="text-brand-muted">{p.payee_bank_name ?? "—"}</span>,
    },
    { header: "Referencia", accessor: (p) => <span className="text-brand-muted">{p.reference ?? "—"}</span> },
    {
      header: "",
      className: "text-right",
      accessor: (p) => (
        <DownloadReceiptButton
          paymentId={p.id}
          label="Comprobante"
          generateAction={generateSupplierPaymentReceiptAction}
        />
      ),
    },
  ];

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-8">
      <div>
        <Link
          href="/expenses"
          className="inline-flex items-center gap-1 text-sm text-brand-muted hover:text-brand-text"
        >
          <ArrowLeft size={14} /> Gastos
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
          <Badge status={expense.status}>{STATUS_LABELS[expense.status] ?? expense.status}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <KpiCard label="Subtotal" value={formatMoney(expense.subtotal, expense.currency)} />
        <KpiCard label="Impuesto" value={formatMoney(expense.tax, expense.currency)} />
        <KpiCard label="Total" value={formatMoney(expense.total, expense.currency)} />
        <KpiCard label="Balance" value={formatMoney(expense.balance, expense.currency)} />
        {expense.payment_method && (
          <KpiCard
            label="Método de pago"
            value={PAYMENT_METHOD_LABELS[expense.payment_method] ?? expense.payment_method}
          />
        )}
        {bankAccount && (
          <KpiCard
            label={expense.payment_method === "CARD" ? "Tarjeta" : "Cuenta"}
            value={bankAccount.name}
          />
        )}
        {expense.payee_bank_name && (
          <KpiCard label="Banco del proveedor" value={expense.payee_bank_name} />
        )}
      </div>

      {canEdit && expense.status === "PENDING" && (
        <ConfirmButton
          label="Cancelar gasto"
          confirmTitle="¿Cancelar este gasto?"
          confirmMessage="Se conserva el registro (nunca se borra un gasto), solo cambia su estado."
          onConfirm={cancelExpenseAction.bind(null, expense.id)}
        />
      )}

      {["PENDING", "PARTIALLY_PAID"].includes(expense.status) && canPay && (
        <div>
          <h2 className="mb-3 text-sm font-medium text-brand-text">Registrar pago</h2>
          {!expense.supplier_id ? (
            <p className="text-sm text-brand-muted">
              Este gasto no tiene proveedor asignado — agrégalo editando el
              gasto para poder registrarle un pago.
            </p>
          ) : bankAccounts.length === 0 ? (
            <p className="text-sm text-brand-muted">
              Necesitas crear al menos una{" "}
              <Link href="/banks/new" className="text-brand-accent hover:underline">
                cuenta bancaria
              </Link>{" "}
              antes de poder registrar un pago — el dinero siempre tiene que
              salir de una cuenta.
            </p>
          ) : (
            <RegisterSupplierPaymentForm
              expenseId={expense.id}
              supplierId={expense.supplier_id}
              projectId={expense.project_id}
              balance={expense.balance}
              currency={expense.currency}
              bankAccounts={bankAccounts}
              bankCatalog={bankCatalog}
            />
          )}
        </div>
      )}

      {payments.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-medium text-brand-text">
            Historial de pagos
          </h2>
          <DataTable columns={paymentColumns} rows={payments} keyFor={(p) => p.id} maxWidth="max-w-4xl" />
        </div>
      )}

      <div className="flex max-w-2xl flex-col gap-4">
        <h2 className="text-sm font-medium text-brand-text">
          Recibos y comprobantes
        </h2>
        {canEdit && (
          <UploadDocumentForm
            entityType="expense"
            entityId={expense.id}
            revalidatePathValue={`/expenses/${expense.id}`}
          />
        )}
        <DocumentList
          documents={documents}
          canDelete={canEdit}
          revalidatePathValue={`/expenses/${expense.id}`}
        />
      </div>

      {isEditable ? (
        <div>
          <h2 className="mb-3 text-sm font-medium text-brand-text">Editar gasto</h2>
          <ExpenseEditForm
            expense={expense}
            categories={categories}
            suppliers={suppliers}
            projects={projects}
            bankCatalog={bankCatalog}
            baseCurrency={company.base_currency}
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
