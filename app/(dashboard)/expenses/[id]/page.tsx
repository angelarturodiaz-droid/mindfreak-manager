import Link from "next/link";
import { safeReturnTo, returnToLabel } from "@/lib/utils/return-to";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, FolderKanban, Tag, Truck, Gift, Lock, Pencil } from "lucide-react";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { InfoHint } from "@/components/ui/info-hint";
import { Button } from "@/components/ui/button";
import {
  getExpense,
  listExpenseCategories,
  listActiveSuppliers,
  listProjectsForSelect,
  listActiveAccountsForSelect,
} from "@/features/expenses/queries";
import { cancelExpenseAction } from "@/features/expenses/actions";
import { listPaymentsForExpense } from "@/features/payments/queries";
import { PAYMENT_METHOD_LABELS } from "@/features/payments/schema";
import { hasPermission } from "@/lib/auth/permissions";
import { ExpenseEditForm } from "./expense-edit-form";
import { RegisterSupplierPaymentForm } from "./register-supplier-payment-form";
import { DocumentList } from "@/components/documents/document-list";
import { UploadDocumentForm } from "@/components/documents/upload-document-form";
import { listDocuments } from "@/features/documents/queries";
import { listBankCatalog } from "@/features/bank-catalog/queries";
import { getCompany } from "@/features/settings/queries";
import { getFxContext, listCurrencyOptions } from "@/features/currencies/queries";
import { getAccountFunds } from "@/features/banks/queries";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Callout, MetricCard, SectionHeader } from "@/components/ui/page-kit";
import { formatDate } from "@/lib/utils/dates";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { RegisteredDate } from "@/components/ui/registered-date";
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
  searchParams: Promise<{ return_to?: string; editar?: string }>;
}) {
  const { id } = await params;
  const openEdit = (await searchParams).editar === "1";
  // Si se abrió desde un proyecto (o proveedor), "volver" regresa ahí.
  const returnTo = safeReturnTo((await searchParams).return_to);

  let expense;
  try {
    expense = await getExpense(id);
  } catch {
    notFound();
  }
  if (!expense) notFound();

  const [categories, suppliers, projects, canEdit, canPay, payments, documents, bankCatalog, company, funds, serviceTypes, canSeeRules, canApprove, currencyOptions, fxContext, paymentAccounts] =
    await Promise.all([
      listExpenseCategories(),
      listActiveSuppliers(),
      listProjectsForSelect(),
      hasPermission("expenses.create"),
      hasPermission("payments.create"),
      listPaymentsForExpense(id),
      listDocuments("expense", id),
      listBankCatalog(),
      getCompany(),
      getAccountFunds(),
      listServiceTypeOptions(),
      hasPermission("settings.manage"),
      hasPermission("expenses.approve"),
      listCurrencyOptions(),
      getFxContext(),
      // Cuentas de banco y tarjetas de crédito activas: un gasto pendiente
      // también se puede pagar después con tarjeta (migración 081).
      listActiveAccountsForSelect(),
    ]);

  // Cómo se pagó de verdad: métodos y cuentas de los pagos registrados.
  const paidMethods = [...new Set(payments.map((p) => p.method).filter(Boolean))] as string[];
  const paidAccounts = [
    ...new Set(
      payments
        .map((p) => {
          const a = p.bank_accounts as { name: string } | { name: string }[] | null;
          return (Array.isArray(a) ? a[0] : a)?.name;
        })
        .filter(Boolean),
    ),
  ] as string[];
  const category = expense.expense_categories as { name: string } | null;
  const supplier = expense.suppliers as { name: string } | null;
  const project = expense.projects as { number: string; name: string } | null;
  const bankAccount = expense.bank_accounts as
    | { name: string; bank_name: string | null }
    | null;

  // V1-2: los incentivos por proyecto no se editan como gasto.
  const isIncentive = Boolean(expense.incentive_mode);
  const isEditable = canEdit && !isIncentive && expense.status === "PENDING" && expense.paid_amount === 0;

  const paymentColumns: Column<PaymentRow>[] = [
    { header: "Fecha", accessor: (p) => <RegisteredDate date={p.payment_date} createdAt={p.created_at} className="text-brand-text" /> },
    {
      header: "Monto",
      className: "text-right",
      accessor: (p) => <span className="font-medium tabular-nums">{formatMoney(p.amount, expense.currency)}</span>,
    },
    {
      // Multimoneda V5: pago desde una cuenta en otra moneda (o con comisión).
      header: "Salió del banco",
      className: "text-right",
      accessor: (p) => {
        const foreign = p.account_currency && p.account_currency !== expense.currency;
        if (!foreign && !p.bank_fee_amount) return <span className="text-brand-muted">—</span>;
        const fn = p.functional_currency ?? company.base_currency;
        const diff = Number(p.informative_difference ?? 0) || Number(p.rounding_difference ?? 0);
        return (
          <span className="flex flex-col items-end text-xs">
            <span className="font-medium tabular-nums text-brand-text">
              {formatMoney(Number(p.account_amount ?? p.amount), p.account_currency ?? expense.currency)}
              {p.bank_fee_amount ? ` + comisión ${formatMoney(Number(p.bank_fee_amount), p.account_currency ?? expense.currency)}` : ""}
            </span>
            {foreign && p.effective_rate && (
              <span className="text-brand-muted">
                Efectiva 1 {p.effective_rate_currency} = {Number(p.effective_rate)} {fn}
                {p.reference_rate || p.reference_rate_document
                  ? ` · ref. ${Number(p.reference_rate ?? p.reference_rate_document)}${p.rate_manual_override ? " (manual)" : ""}`
                  : ""}
              </span>
            )}
            {foreign && diff !== 0 && (
              <span className={Number(p.rounding_difference) !== 0 ? "text-brand-muted" : diff > 0 ? "text-brand-warning" : "text-brand-success"}>
                {Number(p.rounding_difference) !== 0 ? "Redondeo" : "Dif. informativa"} {formatMoney(diff, fn)}
              </span>
            )}
          </span>
        );
      },
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

      {isIncentive && (
        <Callout tone="blue" icon={<Gift size={18} />} title="Incentivo por proyecto">
          <p>
            Para <strong>{expense.incentive_recipient}</strong> (
            {expense.incentive_recipient_type === "EMPLOYEE" ? "empleado" : "tercero"}) · {expense.incentive_reason}.{" "}
            {expense.incentive_mode === "PERCENT"
              ? `Calculado como ${Number(expense.incentive_percent)} % de ${formatMoney(Number(expense.incentive_base), "DOP")} (ganancia antes de incentivos del proyecto al calcularlo).`
              : "Monto fijo."}
          </p>
          <p className="mt-1">
            Sin proveedor, sin ITBIS y sin retenciones: se paga el monto completo. En la rentabilidad del proyecto se
            resta después de los gastos. No se edita aquí: si está mal, cancélalo y crea otro desde el proyecto
            {expense.incentive_mode === "PERCENT" ? " (o usa Recalcular en Finanzas del proyecto)" : ""}.
          </p>
        </Callout>
      )}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total"
          info="Lo que dice la factura del gasto: subtotal + impuesto (ITBIS)."
          value={formatMoney(expense.total, expense.currency)}
          hint={`Subtotal ${formatMoney(expense.subtotal, expense.currency)} + impuesto ${formatMoney(expense.tax, expense.currency)}`}
        />
        <MetricCard
          label="Pagado"
          info="Lo que ya se pagó de este gasto. La barra muestra qué parte del total (o del neto, si hay retenciones) ya salió del banco."
          value={formatMoney(expense.paid_amount, expense.currency)}
          pct={paidPct}
          tone={expense.status === "PAID" ? "success" : undefined}
          hint={withheld > 0 ? `${paidPct.toFixed(0)}% del neto a pagar` : `${paidPct.toFixed(0)}% del total`}
        />
        <MetricCard
          label={withheld > 0 ? "Por pagar (neto)" : "Por pagar"}
          info={
            withheld > 0
              ? "Lo que falta pagarle al proveedor. Ya tiene descontadas las retenciones, que se le pagan a la DGII."
              : "Lo que falta por pagar de este gasto."
          }
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
          <p className="flex items-center gap-1 font-medium text-brand-muted">
            Cómo se pagó
            <InfoHint text="Método y cuenta con que se pagó (o se piensa pagar). Si se pagó en partes con distintos métodos, dice «Varios métodos»." />
          </p>
          {/* Si ya hay pagos, se muestra cómo se pagó de verdad (el método se
              puede decidir al registrar el pago, incluso con tarjeta). */}
          <p className="text-brand-text">
            {paidMethods.length > 1
              ? "Varios métodos"
              : paidMethods.length === 1
                ? PAYMENT_METHOD_LABELS[paidMethods[0]] ?? paidMethods[0]
                : expense.payment_method
                  ? PAYMENT_METHOD_LABELS[expense.payment_method] ?? expense.payment_method
                  : "—"}
          </p>
          {paidAccounts.length > 0 ? (
            <p className="text-xs text-brand-muted">
              {paidMethods.length === 1 && paidMethods[0] === "CARD" ? "Tarjeta" : "Cuenta"}: {paidAccounts.join(", ")}
            </p>
          ) : (
            bankAccount && (
              <p className="text-xs text-brand-muted">
                {expense.payment_method === "CARD" ? "Tarjeta" : "Cuenta"}: {bankAccount.name}
              </p>
            )
          )}
          {expense.payee_bank_name && (
            <p className="text-xs text-brand-muted">Banco del proveedor: {expense.payee_bank_name}</p>
          )}
        </Card>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-8 lg:col-span-2">
          <section className="flex flex-col gap-4">
            <SectionHeader
              title="Pagos"
              count={payments.length}
              description="Cada pago registrado de este gasto: cuándo, cuánto y desde qué cuenta salió el dinero."
            />
            <DataTable
              columns={paymentColumns}
              rows={payments}
              keyFor={(p) => p.id}
              maxWidth="max-w-none"
              emptyMessage="Sin pagos registrados todavía."
            />

            {["PENDING", "PARTIALLY_PAID"].includes(expense.status) && !canPay && (
              <p className="text-sm text-brand-muted">Tu rol no puede registrar pagos. Pídeselo a alguien de Finanzas.</p>
            )}
            {["PENDING", "PARTIALLY_PAID"].includes(expense.status) && canPay && (
              <Card>
                <p className="mb-3 flex items-center gap-1 text-sm font-medium text-brand-text">
                  Registrar pago
                  <InfoHint text="Anota que se pagó (todo o una parte): elige cuánto, la fecha y la cuenta de donde salió el dinero. El gasto y el banco se actualizan solos." />
                </p>
                {!expense.supplier_id && !isIncentive ? (
                  // Un gasto normal necesita proveedor para pagarse (retenciones). Se muestra
                  // la opción desactivada con lo que hay que hacer.
                  <div className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-dashed border-brand-border bg-brand-surface-hover px-4 py-3">
                    <p className="flex items-start gap-2 text-sm text-brand-text">
                      <Lock size={15} className="mt-0.5 shrink-0 text-brand-muted" aria-hidden />
                      <span>
                        <strong>Falta el proveedor.</strong> Para registrar el pago, primero dile al sistema a quién se le
                        paga: así calcula si hay retenciones y el pago queda en la cuenta del proveedor.
                      </span>
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      {isEditable ? (
                        <Link href={`/expenses/${expense.id}?editar=1${returnTo ? `&return_to=${encodeURIComponent(returnTo)}` : ""}#editar-gasto`}>
                          <Button size="sm" variant="outline" icon={<Pencil size={13} />}>
                            Asignar proveedor
                          </Button>
                        </Link>
                      ) : null}
                      <Button size="sm" disabled hint="Se activa cuando el gasto tenga proveedor.">
                        Registrar pago
                      </Button>
                    </div>
                  </div>
                ) : paymentAccounts.length === 0 ? (
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
                    recipientName={isIncentive ? expense.incentive_recipient : null}
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
                    fiscalMissing={(expense.fiscal_snapshot as { missing?: string[] } | null)?.missing ?? []}
                    fiscalRule={(expense.fiscal_snapshot as { rule?: { id?: string; name: string } | null } | null)?.rule ?? null}
                    bankAccounts={paymentAccounts}
                    bankCatalog={bankCatalog}
                    funds={funds}
                    fxContext={fxContext}
                    defaultMethod={expense.payment_method}
                  />
                )}
              </Card>
            )}
          </section>


          {isEditable ? (
            <section id="editar-gasto">
              <CollapsibleSection
                title="Editar gasto"
                description="Cambiar proveedor, categoría, montos o proyecto. Solo mientras está pendiente y sin pagos."
                open={openEdit}
              >
                <ExpenseEditForm
                  expense={expense}
                  categories={categories}
                  suppliers={suppliers}
                  projects={projects}
                  bankCatalog={bankCatalog}
                  baseCurrency={company.base_currency}
                  currencies={currencyOptions.map((c) => c.code)}
                  rates={fxContext.rates}
                  serviceTypes={serviceTypes}
                  canSeeRules={canSeeRules}
                />
              </CollapsibleSection>
            </section>
          ) : (
            expense.status !== "CANCELLED" && !isIncentive && (
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
