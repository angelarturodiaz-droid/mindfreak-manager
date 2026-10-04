import Link from "next/link";
import { safeReturnTo, returnToLabel } from "@/lib/utils/return-to";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, FolderKanban, Tag, Truck } from "lucide-react";
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
import { getAccountFunds } from "@/features/banks/queries";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { MetricCard, SectionHeader } from "@/components/ui/page-kit";
import { formatDate } from "@/lib/utils/dates";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { DownloadReceiptButton } from "@/components/payments/download-receipt-button";
import { listServiceTypeOptions } from "@/features/supplier-service-types/queries";
import { ExpenseFiscalCard, type ExpenseFiscalRow } from "@/components/fiscal/expense-fiscal-card";
import { FiscalStatusBadge } from "@/components/fiscal/fiscal-status-badge";

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
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ return_to?: string }>;
}) {
  const { id } = await params;
  // Si se abrió desde un proyecto (o proveedor), "volver" regresa ahí.
  const returnTo = safeReturnTo((await searchParams).return_to);

  let expense;
  try {
    expense = await getExpense(id);
  } catch {
    notFound();
  }
  if (!expense) notFound();

  const [categories, suppliers, projects, canEdit, canPay, payments, bankAccounts, documents, bankCatalog, company, funds, serviceTypes, canSeeRules, canApprove] =
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
      getAccountFunds(),
      listServiceTypeOptions(),
      hasPermission("settings.manage"),
      hasPermission("expenses.approve"),
    ]);

  const category = expense.expense_categories as { name: string } | null;
  const supplier = expense.suppliers as { name: string } | null;
  const project = expense.projects as { number: string; name: string } | null;
  const bankAccount = expense.bank_accounts as
    | { name: string; bank_name: string | null }
    | null;

  const isEditable = canEdit && expense.status === "PENDING" && expense.paid_amount === 0;

  const paymentColumns: Column<PaymentRow>[] = [
    { header: "Fecha", accessor: (p) => <span className="whitespace-nowrap">{formatDate(p.payment_date)}</span> },
    {
      header: "Monto",
      className: "text-right",
      accessor: (p) => <span className="font-medium tabular-nums">{formatMoney(p.amount, expense.currency)}</span>,
    },
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
        <DownloadReceiptButton paymentId={p.id} label="Comprobante" kind="supplier" />
      ),
    },
  ];

  // Con retenciones se le paga al proveedor el neto, no el total de la factura.
  const netPayable = Number(expense.net_payable ?? expense.total);
  const withheld = Number(expense.total_withheld ?? 0);
  const paidPct = netPayable > 0 ? (expense.paid_amount / netPayable) * 100 : expense.status === "PAID" ? 100 : 0;
  const isOpen = expense.status === "PENDING" || expense.status === "PARTIALLY_PAID";

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-8">
      <Link
        href={returnTo ?? "/expenses"}
        className="inline-flex w-fit items-center gap-1 text-sm text-brand-muted hover:text-brand-text"
      >
        <ArrowLeft size={14} /> {returnTo ? returnToLabel(returnTo) : "Gastos"}
      </Link>

      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-brand-primary">
                {expense.description}
              </h1>
              <Badge status={expense.status}>{STATUS_LABELS[expense.status] ?? expense.status}</Badge>
              {expense.fiscal_status && expense.fiscal_status !== "NOT_EVALUATED" && (
                <FiscalStatusBadge status={expense.fiscal_status} />
              )}
            </div>
            <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <div className="flex items-center gap-1.5">
                <CalendarDays size={15} className="text-brand-muted" aria-hidden />
                <dt className="sr-only">Fecha</dt>
                <dd className="text-brand-text">{formatDate(expense.expense_date)}</dd>
              </div>
              <div className="flex items-center gap-1.5">
                <Tag size={15} className="text-brand-muted" aria-hidden />
                <dt className="sr-only">Categoría</dt>
                <dd className={category ? "text-brand-text" : "text-brand-muted"}>{category?.name ?? "Sin categoría"}</dd>
              </div>
              <div className="flex items-center gap-1.5">
                <Truck size={15} className="text-brand-muted" aria-hidden />
                <dt className="sr-only">Proveedor</dt>
                <dd>
                  {supplier && expense.supplier_id ? (
                    <Link href={`/suppliers/${expense.supplier_id}`} className="text-brand-text hover:text-brand-accent">
                      {supplier.name}
                    </Link>
                  ) : (
                    <span className="text-brand-muted">Sin proveedor</span>
                  )}
                </dd>
              </div>
              <div className="flex items-center gap-1.5">
                <FolderKanban size={15} className="text-brand-muted" aria-hidden />
                <dt className="sr-only">Proyecto</dt>
                <dd>
                  {project && expense.project_id ? (
                    <Link href={`/projects/${expense.project_id}`} className="text-brand-text hover:text-brand-accent">
                      {project.number} — {project.name}
                    </Link>
                  ) : (
                    <span className="text-brand-muted">Gasto de la empresa</span>
                  )}
                </dd>
              </div>
            </dl>
          </div>
          {canEdit && expense.status === "PENDING" && (
            <ConfirmButton
              label="Cancelar gasto"
              confirmTitle="¿Cancelar este gasto?"
              confirmMessage="Se conserva el registro (nunca se borra un gasto), solo cambia su estado."
              onConfirm={cancelExpenseAction.bind(null, expense.id)}
            />
          )}
        </div>
      </Card>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total"
          value={formatMoney(expense.total, expense.currency)}
          hint={`Subtotal ${formatMoney(expense.subtotal, expense.currency)} + impuesto ${formatMoney(expense.tax, expense.currency)}`}
        />
        <MetricCard
          label="Pagado"
          value={formatMoney(expense.paid_amount, expense.currency)}
          pct={paidPct}
          tone={expense.status === "PAID" ? "success" : undefined}
          hint={withheld > 0 ? `${paidPct.toFixed(0)}% del neto a pagar` : `${paidPct.toFixed(0)}% del total`}
        />
        <MetricCard
          label={withheld > 0 ? "Por pagar (neto)" : "Por pagar"}
          value={formatMoney(expense.balance, expense.currency)}
          tone={isOpen && expense.balance > 0 ? "warning" : undefined}
          hint={
            withheld > 0
              ? `Ya descontados ${formatMoney(withheld, expense.currency)} retenidos para la DGII`
              : isOpen && expense.balance > 0
                ? "Saldo pendiente"
                : "Nada pendiente"
          }
        />
        <Card className="flex min-w-0 flex-col gap-1.5 text-sm">
          <p className="font-medium text-brand-muted">Cómo se pagó</p>
          <p className="text-brand-text">
            {expense.payment_method
              ? PAYMENT_METHOD_LABELS[expense.payment_method] ?? expense.payment_method
              : "—"}
          </p>
          {bankAccount && (
            <p className="text-xs text-brand-muted">
              {expense.payment_method === "CARD" ? "Tarjeta" : "Cuenta"}: {bankAccount.name}
            </p>
          )}
          {expense.payee_bank_name && (
            <p className="text-xs text-brand-muted">Banco del proveedor: {expense.payee_bank_name}</p>
          )}
        </Card>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-8 lg:col-span-2">
          <section className="flex flex-col gap-4">
            <SectionHeader title="Pagos" count={payments.length} />
            <DataTable
              columns={paymentColumns}
              rows={payments}
              keyFor={(p) => p.id}
              maxWidth="max-w-none"
              emptyMessage="Sin pagos registrados todavía."
            />

            {["PENDING", "PARTIALLY_PAID"].includes(expense.status) && canPay && (
              <Card>
                <p className="mb-3 text-sm font-medium text-brand-text">Registrar pago</p>
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
                    fiscal={
                      withheld > 0
                        ? {
                            total: Number(expense.total),
                            isrRate: Number(expense.isr_rate),
                            isrBasePct: Number(expense.isr_base_pct),
                            itbisRetentionPct: Number(expense.itbis_retention_pct),
                            isrWithheld: Number(expense.isr_withheld),
                            itbisWithheld: Number(expense.itbis_withheld),
                            totalWithheld: withheld,
                            netPayable,
                          }
                        : null
                    }
                    fiscalStatus={expense.fiscal_status ?? "NOT_EVALUATED"}
                    bankAccounts={bankAccounts}
                    bankCatalog={bankCatalog}
                    funds={funds}
                  />
                )}
              </Card>
            )}
          </section>

          {isEditable ? (
            <section>
              <SectionHeader title="Editar gasto" description="Solo mientras está pendiente y sin pagos." />
              <Card>
                <ExpenseEditForm
                  expense={expense}
                  categories={categories}
                  suppliers={suppliers}
                  projects={projects}
                  bankCatalog={bankCatalog}
                  baseCurrency={company.base_currency}
                  serviceTypes={serviceTypes}
                  canSeeRules={canSeeRules}
                />
              </Card>
            </section>
          ) : (
            expense.status !== "CANCELLED" && (
              <p className="text-sm text-brand-muted">
                Este gasto ya no se puede editar (tiene pagos registrados o no está
                pendiente).
              </p>
            )
          )}
        </div>

        <aside className="flex flex-col gap-4">
          {expense.status !== "CANCELLED" && (
            <ExpenseFiscalCard
              expense={expense as unknown as ExpenseFiscalRow}
              canRecalculate={isEditable}
              canOverride={canApprove && expense.status === "PENDING" && expense.paid_amount === 0}
              canSeeRules={canSeeRules}
            />
          )}
          <SectionHeader
            title="Recibos y comprobantes"
            count={documents.length}
          />
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
        </aside>
      </div>
    </main>
  );
}
