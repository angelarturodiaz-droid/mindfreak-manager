import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Copy,
  Send,
  Check,
  Building2,
  CalendarDays,
  Clock,
  FileText,
  FolderKanban,
} from "lucide-react";
import {
  getInvoice,
  listInvoiceItems,
  listActiveServices,
  listProjectItemsFor,
  listCompanyUsersForSelect,
  listCollectionHistory,
} from "@/features/invoices/queries";
import {
  deleteInvoiceItemAction,
  issueInvoiceAction,
  cancelInvoiceAction,
} from "@/features/invoices/actions";
import { ResponsibleSelector } from "./responsible-selector";
import { AddCollectionHistoryForm } from "./add-collection-history-form";
import { listPaymentsForInvoice, listBankAccounts } from "@/features/payments/queries";
import { PAYMENT_METHOD_LABELS } from "@/features/payments/schema";
import { listPaymentTerms } from "@/features/payment-terms/queries";
import { getDefaultTaxRate, listTaxRates } from "@/features/tax-rates/queries";
import { TAX_TREATMENT_LABELS } from "@/features/tax-rates/schema";
import { hasPermission } from "@/lib/auth/permissions";
import { NewInvoiceItemForm } from "./new-item-form";
import { InvoiceHeaderForm } from "./invoice-header-form";
import { RegisterPaymentForm } from "./register-payment-form";
import { InvoiceShareLinkButton } from "./share-link-button";
import { DuplicateInvoiceButton } from "./duplicate-invoice-button";
import { DiscardInvoiceButton } from "./discard-invoice-button";
import { ActionButton } from "@/components/ui/action-button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Chip, ProgressBar, SectionHeader } from "@/components/ui/page-kit";
import { relationName, relationRow } from "@/lib/utils/relation";
import { dueLabel, formatDate } from "@/lib/utils/dates";
import { DownloadReceiptButton } from "@/components/payments/download-receipt-button";

const COLLECTION_ACTION_LABELS: Record<string, string> = {
  CALL: "Llamada",
  EMAIL: "Correo",
  WHATSAPP: "WhatsApp",
  VISIT: "Visita",
  NOTE: "Nota",
  OTHER: "Otro",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  ISSUED: "Emitida",
  PARTIALLY_PAID: "Pago parcial",
  PAID: "Pagada",
  OVERDUE: "Vencida",
  CANCELLED: "Cancelada",
};

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency }).format(
    amount,
  );
}

type ItemRow = Awaited<ReturnType<typeof listInvoiceItems>>[number];
type PaymentRow = Awaited<ReturnType<typeof listPaymentsForInvoice>>[number];

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let invoice;
  try {
    invoice = await getInvoice(id);
  } catch {
    notFound();
  }
  if (!invoice) notFound();

  const [items, services, canEdit, canPay, projectItems, payments, bankAccounts, paymentTerms, defaultTaxRate, companyUsers, collectionHistory, taxRates] =
    await Promise.all([
      listInvoiceItems(id),
      listActiveServices(),
      hasPermission("invoices.create"),
      hasPermission("payments.create"),
      invoice.project_id ? listProjectItemsFor(invoice.project_id) : Promise.resolve([]),
      listPaymentsForInvoice(id),
      listBankAccounts(),
      listPaymentTerms(),
      getDefaultTaxRate(),
      listCompanyUsersForSelect(),
      listCollectionHistory(id),
      listTaxRates(),
    ]);

  const clientData = invoice.clients as { name: string } | { name: string }[] | null;
  const clientName = Array.isArray(clientData) ? clientData[0]?.name : clientData?.name;
  const duplicatedFromData = invoice.duplicated_from as { number: string } | { number: string }[] | null;
  const duplicatedFromNumber = Array.isArray(duplicatedFromData)
    ? duplicatedFromData[0]?.number
    : duplicatedFromData?.number;
  const projectData = invoice.projects as
    | { number: string; name: string }
    | { number: string; name: string }[]
    | null;
  const project = Array.isArray(projectData) ? projectData[0] : projectData;

  const isEditable = invoice.status === "DRAFT";

  const itemColumns: Column<ItemRow>[] = [
    { header: "Descripción", accessor: (item) => item.description },
    { header: "Cant.", className: "text-right", accessor: (item) => <span className="tabular-nums">{item.quantity}</span> },
    { header: "Precio", className: "text-right", accessor: (item) => <span className="tabular-nums">{formatMoney(item.unit_price, invoice.currency)}</span> },
    {
      header: "Descuento",
      className: "text-right",
      accessor: (item) =>
        item.discount > 0 ? (
          <span className="tabular-nums">-{formatMoney(item.discount, invoice.currency)}</span>
        ) : (
          <span className="text-brand-muted">—</span>
        ),
    },
    {
      header: "Impuesto",
      accessor: (item) => (
        <span>
          {formatMoney(item.tax, invoice.currency)}{" "}
          <span className="text-xs text-brand-muted">
            ({TAX_TREATMENT_LABELS[item.tax_treatment as keyof typeof TAX_TREATMENT_LABELS] ?? item.tax_treatment}
            {item.tax_treatment === "GRAVADO" ? ` ${item.tax_rate_percent}%` : ""})
          </span>
        </span>
      ),
    },
    {
      header: "Total",
      className: "text-right",
      accessor: (item) => <span className="font-medium tabular-nums">{formatMoney(item.subtotal, invoice.currency)}</span>,
    },
    {
      header: "",
      className: "text-right",
      accessor: (item) =>
        isEditable && canEdit ? (
          <ConfirmButton
            label="Eliminar"
            confirmTitle="¿Eliminar esta línea?"
            onConfirm={deleteInvoiceItemAction.bind(null, item.id, invoice.id)}
          />
        ) : null,
    },
  ];

  const paymentColumns: Column<PaymentRow>[] = [
    { header: "Fecha", accessor: (p) => <span className="whitespace-nowrap">{formatDate(p.payment_date)}</span> },
    {
      header: "Monto",
      className: "text-right",
      accessor: (p) => <span className="font-medium tabular-nums text-brand-success">{formatMoney(p.amount, invoice.currency)}</span>,
    },
    { header: "Método", accessor: (p) => <span className="text-brand-muted">{PAYMENT_METHOD_LABELS[p.method] ?? p.method}</span> },
    {
      header: "Banco",
      accessor: (p) => {
        const account = p.bank_accounts as
          | { name: string; bank_name: string | null }
          | { name: string; bank_name: string | null }[]
          | null;
        const a = Array.isArray(account) ? account[0] : account;
        return <span className="text-brand-muted">{a ? `${a.name}${a.bank_name ? ` (${a.bank_name})` : ""}` : "—"}</span>;
      },
    },
    { header: "Referencia", accessor: (p) => <span className="text-brand-muted">{p.reference || "—"}</span> },
    {
      header: "",
      className: "text-right",
      accessor: (p) => (
        <DownloadReceiptButton paymentId={p.id} label="Recibo" kind="customer" />
      ),
    },
  ];

  const ptName = invoice.payment_terms_id ? relationName(invoice.payment_terms) : null;
  const isOpen = ["ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(invoice.status);
  const due = invoice.due_date && isOpen ? dueLabel(invoice.due_date) : null;
  const paidPct = invoice.total > 0 ? (invoice.paid_amount / invoice.total) * 100 : 0;
  const FLOW = ["Borrador", "Emitida", "Pago parcial", "Pagada"];
  const flowIndex =
    invoice.status === "DRAFT"
      ? 0
      : invoice.status === "ISSUED" || invoice.status === "OVERDUE"
        ? 1
        : invoice.status === "PARTIALLY_PAID"
          ? 2
          : invoice.status === "PAID"
            ? 3
            : -1;

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-8">
      <Link
        href="/invoices"
        className="inline-flex w-fit items-center gap-1 text-sm text-brand-muted hover:text-brand-text"
      >
        <ArrowLeft size={14} /> Facturas
      </Link>

      <Card className="flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-brand-primary">
                {invoice.number}
              </h1>
              <Badge status={invoice.status}>{STATUS_LABELS[invoice.status] ?? invoice.status}</Badge>
              {due && (
                <Chip tone={due.days < 0 ? "danger" : due.days <= 3 ? "warning" : "muted"}>{due.label}</Chip>
              )}
              {invoice.duplicated_from_id && (
                <Badge tone="neutral">
                  <Copy size={12} className="shrink-0" aria-hidden="true" />
                  Duplicada
                  {duplicatedFromNumber && (
                    <>
                      {" de "}
                      <Link
                        href={`/invoices/${invoice.duplicated_from_id}`}
                        className="underline hover:text-brand-accent"
                      >
                        {duplicatedFromNumber}
                      </Link>
                    </>
                  )}
                </Badge>
              )}
            </div>
            <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <div className="flex items-center gap-1.5">
                <Building2 size={15} className="text-brand-muted" aria-hidden />
                <dt className="sr-only">Cliente</dt>
                <dd>
                  <Link href={`/clients/${invoice.client_id}`} className="font-medium text-brand-text hover:text-brand-accent">
                    {clientName ?? "—"}
                  </Link>
                </dd>
              </div>
              {project && invoice.project_id && (
                <div className="flex items-center gap-1.5">
                  <FolderKanban size={15} className="text-brand-muted" aria-hidden />
                  <dt className="sr-only">Proyecto</dt>
                  <dd>
                    <Link href={`/projects/${invoice.project_id}`} className="text-brand-text hover:text-brand-accent">
                      {project.number} · {project.name}
                    </Link>
                  </dd>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <CalendarDays size={15} className="text-brand-muted" aria-hidden />
                <dt className="sr-only">Emitida</dt>
                <dd className="text-brand-text">Emitida {formatDate(invoice.issue_date)}</dd>
              </div>
              {invoice.due_date && (
                <div className="flex items-center gap-1.5">
                  <Clock size={15} className="text-brand-muted" aria-hidden />
                  <dt className="sr-only">Vence</dt>
                  <dd className="text-brand-text">Vence {formatDate(invoice.due_date)}</dd>
                </div>
              )}
              {ptName && (
                <div className="flex items-center gap-1.5">
                  <FileText size={15} className="text-brand-muted" aria-hidden />
                  <dt className="sr-only">Condición de pago</dt>
                  <dd className="text-brand-text">{ptName}</dd>
                </div>
              )}
            </dl>
          </div>
          <div className="grid grid-cols-2 gap-6 text-left sm:text-right">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-brand-muted">Total</p>
              <p className="text-xl font-semibold tracking-tight tabular-nums text-brand-primary">
                {formatMoney(invoice.total, invoice.currency)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-brand-muted">Balance</p>
              <p
                className={`text-xl font-semibold tracking-tight tabular-nums ${
                  invoice.balance > 0 && isOpen
                    ? invoice.status === "OVERDUE"
                      ? "text-brand-danger"
                      : "text-brand-warning"
                    : "text-brand-text"
                }`}
              >
                {formatMoney(invoice.balance, invoice.currency)}
              </p>
            </div>
          </div>
        </div>

        {flowIndex >= 0 ? (
          <ol className="grid grid-cols-2 gap-2 border-t border-brand-border pt-5 sm:grid-cols-4" aria-label="Avance de la factura">
            {FLOW.map((label, i) => {
              const done = i < flowIndex;
              const current = i === flowIndex;
              const overdue = current && invoice.status === "OVERDUE";
              return (
                <li
                  key={label}
                  aria-current={current ? "step" : undefined}
                  className={`flex items-center gap-2.5 rounded-[var(--radius-md)] border px-3 py-2.5 ${
                    overdue
                      ? "border-brand-danger/40 bg-brand-danger-bg"
                      : current
                        ? "border-brand-accent/40 bg-brand-accent-light"
                        : "border-brand-border bg-brand-surface"
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                      done
                        ? "bg-brand-success text-white"
                        : overdue
                          ? "bg-brand-danger text-white"
                          : current
                            ? "bg-brand-accent text-white"
                            : "border border-brand-border text-brand-muted"
                    }`}
                  >
                    {done ? <Check size={14} /> : i + 1}
                  </span>
                  <span className={`text-sm ${current ? "font-semibold text-brand-text" : done ? "text-brand-text" : "text-brand-muted"}`}>
                    {overdue ? "Emitida · vencida" : label}
                  </span>
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="rounded-[var(--radius-md)] bg-brand-danger-bg px-4 py-3 text-sm font-medium text-brand-danger">
            Esta factura fue cancelada. Se conserva para auditoría.
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-brand-border pt-4">
          <div className="flex flex-wrap gap-2">
            {isEditable && canEdit && (
              <ActionButton
                label="Emitir factura"
                variant="primary"
                className="!bg-brand-success"
                icon={<Send size={14} />}
                onAction={issueInvoiceAction.bind(null, invoice.id)}
              />
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <InvoiceShareLinkButton invoiceId={invoice.id} />
            {canEdit && <DuplicateInvoiceButton invoiceId={invoice.id} />}
            {invoice.status !== "CANCELLED" &&
              invoice.status !== "PAID" &&
              canEdit && (
                <ConfirmButton
                  label="Cancelar factura"
                  confirmTitle="¿Cancelar esta factura?"
                  confirmMessage="Se conserva el registro para auditoría, pero ya no se podrá editar."
                  onConfirm={cancelInvoiceAction.bind(null, invoice.id)}
                />
              )}
            {invoice.status === "DRAFT" && canEdit && (
              <DiscardInvoiceButton invoiceId={invoice.id} />
            )}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-8 lg:col-span-2">
          <section className="flex flex-col gap-4">
            <SectionHeader
              title="Líneas de factura"
              count={items.length}
              description={isEditable ? undefined : "Solo se pueden editar mientras la factura está en Borrador."}
            />
            <DataTable columns={itemColumns} rows={items} keyFor={(i) => i.id} maxWidth="max-w-none" emptyMessage="Sin líneas todavía." />

            {isEditable && canEdit && (
              <Card>
                <p className="mb-3 text-sm font-medium text-brand-text">Agregar línea</p>
                <NewInvoiceItemForm
                  invoiceId={invoice.id}
                  services={services}
                  projectItems={projectItems}
                  defaultTaxRate={defaultTaxRate}
                  taxRates={taxRates}
                />
              </Card>
            )}
          </section>

          <section className="flex flex-col gap-4">
            <SectionHeader title="Cobros" count={payments.length} />
            <DataTable columns={paymentColumns} rows={payments} keyFor={(p) => p.id} maxWidth="max-w-none" emptyMessage="Sin cobros registrados todavía." />

            {["ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(invoice.status) &&
              invoice.balance > 0 &&
              canPay && (
                <Card>
                  <p className="mb-3 text-sm font-medium text-brand-text">Registrar cobro</p>
                  {bankAccounts.length === 0 ? (
                    <p className="text-sm text-brand-muted">
                      Necesitas crear al menos una{" "}
                      <Link href="/banks/new" className="text-brand-accent hover:underline">
                        cuenta bancaria
                      </Link>{" "}
                      antes de poder registrar un cobro — el dinero siempre tiene
                      que quedar asociado a una cuenta.
                    </p>
                  ) : (
                    <RegisterPaymentForm
                      invoiceId={invoice.id}
                      clientId={invoice.client_id}
                      projectId={invoice.project_id}
                      balance={invoice.balance}
                      currency={invoice.currency}
                      bankAccounts={bankAccounts}
                    />
                  )}
                </Card>
              )}
          </section>
        </div>

        <aside className="flex flex-col gap-4">
          <Card className="text-sm">
            <p className="mb-3 text-sm font-semibold text-brand-text">Resumen</p>
            <div className="flex items-center justify-between">
              <span className="text-brand-muted">Subtotal</span>
              <span className="font-medium tabular-nums">
                {formatMoney(invoice.subtotal, invoice.currency)}
              </span>
            </div>
            {invoice.commission_percent > 0 && (
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <span className="text-brand-muted">
                  Comisión ({invoice.commission_percent}%){" "}
                  <span className="text-xs">
                    (
                    {TAX_TREATMENT_LABELS[invoice.commission_tax_treatment as keyof typeof TAX_TREATMENT_LABELS] ??
                      invoice.commission_tax_treatment}
                    )
                  </span>
                </span>
                <span className="font-medium tabular-nums">
                  {formatMoney(invoice.commission_amount, invoice.currency)}
                </span>
              </div>
            )}
            <div className="mt-1.5 flex items-center justify-between">
              <span className="text-brand-muted">Descuento</span>
              <span className="font-medium tabular-nums">
                -{formatMoney(invoice.discount, invoice.currency)}
              </span>
            </div>
            <div className="mt-1.5 flex items-center justify-between">
              <span className="text-brand-muted">Impuesto</span>
              <span className="font-medium tabular-nums">
                {formatMoney(invoice.tax, invoice.currency)}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-brand-border pt-3">
              <span className="font-medium text-brand-text">Total</span>
              <span className="text-lg font-semibold tabular-nums text-brand-primary">
                {formatMoney(invoice.total, invoice.currency)}
              </span>
            </div>
            <div className="mt-3 flex flex-col gap-2 border-t border-brand-border pt-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-brand-muted">Pagado</span>
                <span className="font-medium tabular-nums text-brand-success">
                  {formatMoney(invoice.paid_amount, invoice.currency)}
                </span>
              </div>
              <ProgressBar pct={paidPct} />
              <div className="flex items-center justify-between">
                <span className="text-brand-muted">Balance pendiente</span>
                <span className="font-semibold tabular-nums text-brand-text">
                  {formatMoney(invoice.balance, invoice.currency)}
                </span>
              </div>
            </div>
          </Card>

          {isEditable && canEdit && (
            <Card>
              <p className="mb-3 text-sm font-semibold text-brand-text">NCF / Vencimiento</p>
              <InvoiceHeaderForm invoice={invoice} paymentTerms={paymentTerms} />
            </Card>
          )}

          <Card>
            <p className="mb-3 text-sm font-semibold text-brand-text">Gestión de cobro</p>
            <ResponsibleSelector
              invoiceId={invoice.id}
              currentUserId={invoice.responsible_user_id}
              users={companyUsers}
            />

            <div className="mt-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-muted">
                Historial
              </h3>
              {collectionHistory.length === 0 ? (
                <p className="mb-4 text-sm text-brand-muted">Sin gestiones registradas todavía.</p>
              ) : (
                <ol className="mb-4 flex flex-col gap-3 border-l-2 border-brand-border pl-4">
                  {collectionHistory.map((h) => {
                    const profile = relationRow<{ full_name: string | null }>(h.profiles);
                    return (
                      <li key={h.id} className="relative text-sm">
                        <span className="absolute -left-[1.3rem] top-1.5 h-2 w-2 rounded-full bg-brand-accent" aria-hidden />
                        <p className="text-brand-text">
                          <span className="font-medium">{COLLECTION_ACTION_LABELS[h.action] ?? h.action}</span>
                          <span className="text-brand-muted">
                            {" · "}
                            {formatDate(h.action_date)}
                            {" · "}
                            {profile?.full_name ?? "—"}
                          </span>
                        </p>
                        {h.comment && <p className="text-brand-muted">{h.comment}</p>}
                        {h.result && <p className="text-xs text-brand-muted">Resultado: {h.result}</p>}
                        {h.next_action_date && (
                          <p className="text-xs text-brand-muted">Próxima acción: {formatDate(h.next_action_date)}</p>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
              <AddCollectionHistoryForm invoiceId={invoice.id} />
            </div>
          </Card>
        </aside>
      </div>
    </main>
  );
}
