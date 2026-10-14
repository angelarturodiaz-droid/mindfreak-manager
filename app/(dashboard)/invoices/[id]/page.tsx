import Link from "next/link";
import { safeReturnTo, returnToLabel } from "@/lib/utils/return-to";
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
  MailCheck,
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
  markInvoiceSentAction,
  unmarkInvoiceSentAction,
  updateInvoiceBankDetailsAction,
} from "@/features/invoices/actions";
import { listBankDetailOptions } from "@/features/banks/bank-details-server";
import { getAccountFunds } from "@/features/banks/queries";
import { parseBankDetails } from "@/features/banks/bank-details";
import { BankDetailsPicker } from "@/components/documents/bank-details-picker";
import { NextStepBar, SideSection, TotalsStrip } from "@/components/documents/doc-layout";
import { listCategoryOptions } from "@/features/expense-categories/queries";
import { ResponsibleSelector } from "./responsible-selector";
import { AddCollectionHistoryForm } from "./add-collection-history-form";
import { listPaymentsForInvoice, listBankAccounts } from "@/features/payments/queries";
import { getFxContext } from "@/features/currencies/queries";
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
import { isInvoiceOverdue } from "@/features/invoices/overdue";
import { Card } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { RegisteredDate } from "@/components/ui/registered-date";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Chip, SectionHeader } from "@/components/ui/page-kit";
import { relationName, relationRow } from "@/lib/utils/relation";
import { dueLabel, formatDate, formatDateTime } from "@/lib/utils/dates";
import { DownloadReceiptButton } from "@/components/payments/download-receipt-button";
import { WithholdingList, type WithholdingItem } from "@/components/payments/withholding-list";

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
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ return_to?: string }>;
}) {
  const { id } = await params;
  // Si se abrió desde un proyecto (o proveedor), "volver" regresa ahí.
  const returnTo = safeReturnTo((await searchParams).return_to);

  let invoice;
  try {
    invoice = await getInvoice(id);
  } catch {
    notFound();
  }
  if (!invoice) notFound();

  const [items, services, canEdit, canPay, projectItems, payments, bankAccounts, paymentTerms, defaultTaxRate, companyUsers, collectionHistory, taxRates, categories, fxContext, bankDetailOptions, funds] =
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
      // Categorías para el cobro; si no se pueden leer, el cobro usa la automática.
      listCategoryOptions().catch(() => []),
      getFxContext(),
      // Cuentas que se pueden poner en "Datos bancarios para el pago".
      listBankDetailOptions().catch(() => []),
      // Saldo de las cuentas (informativo en Registrar cobro).
      getAccountFunds(),
    ]);
  // Anular retenciones del cliente (migración 083).
  const canVoid = await hasPermission("payments.void");

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
  // "Enviada al cliente": marca informativa, no cambia el estado.
  const canMarkSent = canEdit && invoice.status !== "DRAFT" && invoice.status !== "CANCELLED";
  const sentByName = relationRow<{ full_name: string | null }>(invoice.sent_by)?.full_name ?? null;

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

  // Hay retenciones (activas o anuladas) en algún cobro: columnas Recibido / Retenciones / Aplicado.
  const hasWithholdings = payments.some((p) => (p.customer_payment_withholdings ?? []).length > 0);
  const paymentColumns: Column<PaymentRow>[] = [
    { header: "Fecha", accessor: (p) => <RegisteredDate date={p.payment_date} createdAt={p.created_at} className="text-brand-text" /> },
    {
      header: hasWithholdings ? "Recibido" : "Monto",
      className: "text-right",
      accessor: (p) =>
        Number(p.amount) > 0 ? (
          <span className="font-medium tabular-nums text-brand-success">{formatMoney(p.amount, invoice.currency)}</span>
        ) : (
          <span className="text-xs text-brand-muted">Solo retención</span>
        ),
    },
    ...(hasWithholdings
      ? [
          {
            header: "Retenciones",
            accessor: (p: PaymentRow) => (
              <WithholdingList
                items={(p.customer_payment_withholdings ?? []) as WithholdingItem[]}
                invoiceId={invoice.id}
                functionalCurrency={fxContext.functionalCurrency}
                canEdit={canPay}
                canVoid={canVoid && invoice.status !== "CANCELLED"}
              />
            ),
          },
          {
            header: "Aplicado",
            className: "text-right",
            accessor: (p: PaymentRow) => (
              <span className="font-semibold tabular-nums text-brand-text">
                {formatMoney(Number(p.amount_applied ?? p.amount), invoice.currency)}
              </span>
            ),
          } as Column<PaymentRow>,
        ]
      : []),
    {
      // Multimoneda V5: cobro recibido en una cuenta en otra moneda (o con comisión).
      header: "Entró al banco",
      className: "text-right",
      accessor: (p) => {
        const foreign = p.account_currency && p.account_currency !== invoice.currency;
        if (!foreign && !p.bank_fee_amount) return <span className="text-brand-muted">—</span>;
        const acc = p.account_currency ?? invoice.currency;
        const fn = p.functional_currency ?? fxContext.functionalCurrency;
        const diff = Number(p.informative_difference ?? 0) || Number(p.rounding_difference ?? 0);
        return (
          <span className="flex flex-col items-end text-xs">
            <span className="font-medium tabular-nums text-brand-text">
              {formatMoney(Number(p.account_amount ?? p.amount), acc)}
              {p.bank_fee_amount ? ` − comisión ${formatMoney(Number(p.bank_fee_amount), acc)}` : ""}
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
  // Vencida por fecha (no hay estado guardado que lo marque; ver features/invoices/overdue.ts).
  const overdueNow = isInvoiceOverdue(invoice);
  const shownStatus = overdueNow ? "OVERDUE" : invoice.status;
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

  // Qué hacer ahora, según el estado (franja "Siguiente paso").
  const balanceText = formatMoney(invoice.balance, invoice.currency);
  const nextStep: { tone: "next" | "warning" | "done"; text: string } | null =
    invoice.status === "CANCELLED"
      ? null
      : invoice.status === "DRAFT"
        ? items.length === 0
          ? { tone: "next", text: "agrega las líneas de la factura (abajo, en Agregar línea)." }
          : { tone: "next", text: "revisa las líneas, el NCF y el vencimiento, y pulsa Emitir factura." }
        : invoice.status === "PAID"
          ? { tone: "done", text: "la factura está pagada. No queda nada pendiente." }
          : overdueNow && due
            ? {
                tone: "warning",
                text: `${due.label.toLowerCase()}. Anota la gestión de cobro (a la derecha) y registra el cobro cuando pague. Falta ${balanceText}.`,
              }
            : !invoice.sent_to_client_at
              ? { tone: "next", text: "envíasela al cliente (Compartir o PDF) y pulsa Marcar como enviada al cliente." }
              : { tone: "next", text: `registra los cobros a medida que el cliente pague (abajo, en Registrar cobro). Falta ${balanceText}.` };

  // Datos bancarios: lo guardado en la factura y, si está pagada, dónde entró el dinero.
  const invoiceBankDetails = parseBankDetails(invoice.bank_details);
  const paidInAccounts = [
    ...new Set(
      payments
        .map((p) => relationRow<{ name: string; bank_name: string | null }>(p.bank_accounts)?.name)
        .filter((n): n is string => Boolean(n)),
    ),
  ];
  const bankSummary =
    invoice.status === "PAID" && paidInAccounts.length
      ? `Cobrada en: ${paidInAccounts.join(", ")}`
      : invoiceBankDetails.length
        ? `En el PDF: ${invoiceBankDetails.map((d) => d.account_name).join(", ")}`
        : "Sin cuentas en el PDF";
  const responsibleName =
    companyUsers.find((u) => u.id === invoice.responsible_user_id)?.full_name ?? null;
  const collectionSummary = `${responsibleName ? `Responsable: ${responsibleName}` : "Sin responsable"} · ${
    collectionHistory.length === 1 ? "1 gestión" : `${collectionHistory.length} gestiones`
  }`;

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-8">
      <Link
        href={returnTo ?? "/invoices"}
        className="inline-flex w-fit items-center gap-1 text-sm text-brand-muted hover:text-brand-text"
      >
        <ArrowLeft size={14} /> {returnTo ? returnToLabel(returnTo) : "Facturas"}
      </Link>

      <Card className="flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-brand-primary">
                {invoice.number}
              </h1>
              <Badge status={shownStatus}>{STATUS_LABELS[shownStatus] ?? shownStatus}</Badge>
              {due && (
                <Chip tone={due.days < 0 ? "danger" : due.days <= 3 ? "warning" : "muted"}>{due.label}</Chip>
              )}
              {invoice.sent_to_client_at && (
                <Chip tone="success">
                  <MailCheck size={12} className="mr-1 shrink-0" aria-hidden="true" />
                  Enviada al cliente el {formatDateTime(invoice.sent_to_client_at)}
                  {sentByName ? ` por ${sentByName}` : ""}
                </Chip>
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
        </div>

        {flowIndex >= 0 ? (
          <ol className="grid grid-cols-2 gap-2 border-t border-brand-border pt-5 sm:grid-cols-4" aria-label="Avance de la factura">
            {FLOW.map((label, i) => {
              // Cada paso completado se pinta en verde. "Pagada" es el último:
              // cuando se llega a él ya está completo (verde), no en curso.
              const isPaid = invoice.status === "PAID";
              const done = i < flowIndex || (isPaid && i === flowIndex);
              const current = i === flowIndex && !isPaid;
              const overdue = current && overdueNow;
              return (
                <li
                  key={label}
                  aria-current={current ? "step" : undefined}
                  className={`flex items-center gap-2.5 rounded-[var(--radius-md)] border px-3 py-2.5 ${
                    overdue
                      ? "border-brand-danger/40 bg-brand-danger-bg"
                      : done
                        ? "border-brand-success/40 bg-brand-success-bg"
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
                  <span className={`text-sm ${current || (isPaid && i === flowIndex) ? "font-semibold text-brand-text" : done ? "text-brand-text" : "text-brand-muted"}`}>
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

        {nextStep && <NextStepBar tone={nextStep.tone}>{nextStep.text}</NextStepBar>}

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
            {canMarkSent && !invoice.sent_to_client_at && (
              <ActionButton
                label="Marcar como enviada al cliente"
                icon={<MailCheck size={14} />}
                successMessage="Factura marcada como enviada al cliente."
                onAction={markInvoiceSentAction.bind(null, invoice.id)}
              />
            )}
            {canMarkSent && invoice.sent_to_client_at && (
              <ActionButton
                label="Quitar marca de enviada"
                variant="ghost"
                successMessage="Se quitó la marca de enviada."
                onAction={unmarkInvoiceSentAction.bind(null, invoice.id)}
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

      <TotalsStrip
        items={[
          { label: "Subtotal", value: formatMoney(invoice.subtotal, invoice.currency) },
          ...(invoice.commission_percent > 0
            ? [
                {
                  label: `Comisión (${invoice.commission_percent}%)`,
                  value: formatMoney(invoice.commission_amount, invoice.currency),
                  note:
                    TAX_TREATMENT_LABELS[invoice.commission_tax_treatment as keyof typeof TAX_TREATMENT_LABELS] ??
                    invoice.commission_tax_treatment,
                },
              ]
            : []),
          {
            label: "Descuento",
            value: invoice.discount > 0 ? `−${formatMoney(invoice.discount, invoice.currency)}` : "—",
            tone: invoice.discount > 0 ? ("default" as const) : ("muted" as const),
          },
          { label: "Impuesto", value: formatMoney(invoice.tax, invoice.currency) },
          { label: "Total", value: formatMoney(invoice.total, invoice.currency), tone: "strong" as const },
          {
            label: "Aplicado",
            value: formatMoney(invoice.paid_amount, invoice.currency),
            tone: "success" as const,
            info: "Lo que ya rebajó el saldo: dinero recibido en banco + retenciones del cliente.",
            note:
              Number(invoice.withholding_total) > 0
                ? `Recibido ${formatMoney(invoice.paid_amount - Number(invoice.withholding_total), invoice.currency)} · Retenciones ${formatMoney(Number(invoice.withholding_total), invoice.currency)}`
                : undefined,
          },
          {
            label: "Balance pendiente",
            value: formatMoney(invoice.balance, invoice.currency),
            tone:
              invoice.balance > 0 && isOpen
                ? overdueNow
                  ? ("danger" as const)
                  : ("warning" as const)
                : ("default" as const),
          },
        ]}
        progress={
          invoice.status === "DRAFT" || invoice.status === "CANCELLED"
            ? undefined
            : { pct: paidPct, label: `${Math.round(paidPct)} % aplicado`, danger: overdueNow }
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-8 lg:col-span-2">
          {/* En Borrador lo primero son las líneas; ya emitida, los cobros. */}
          <section className={`flex flex-col gap-4 ${isEditable ? "order-1" : "order-2"}`}>
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
                  currency={invoice.currency}
                />
              </Card>
            )}
          </section>

          {/* Una factura en Borrador todavía no recibe cobros. */}
          {invoice.status !== "DRAFT" && (
          <section className={`flex flex-col gap-4 ${isEditable ? "order-2" : "order-1"}`}>
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
                      categories={categories}
                      fxContext={fxContext}
                      funds={funds}
                      invoiceRate={Number(invoice.exchange_rate) || 1}
                    />
                  )}
                </Card>
              )}
          </section>
          )}
        </div>

        <aside className="flex flex-col gap-4">
          <SideSection
            title={invoice.status === "PAID" ? "Datos bancarios" : "Datos bancarios para el pago"}
            info={
              invoice.status === "PAID"
                ? "Cuenta(s) donde entraron los cobros de esta factura. En la ⓘ de abajo están las cuentas que salieron en el PDF."
                : "Las cuentas que marques salen abajo en el PDF para que el cliente sepa dónde pagar. Se ofrecen las cuentas marcadas en Bancos como \"Mostrar en facturas y cotizaciones\"; nunca tarjetas."
            }
            summary={bankSummary}
            defaultOpen={invoice.status !== "PAID" && invoice.status !== "CANCELLED"}
          >
            <BankDetailsPicker
              docLabel="factura"
              currency={invoice.currency}
              options={bankDetailOptions}
              current={invoiceBankDetails}
              editable={canEdit && invoice.status !== "CANCELLED" && invoice.status !== "PAID"}
              lockedReason={invoice.status === "CANCELLED" ? "La factura está cancelada." : undefined}
              paidIn={invoice.status === "PAID" ? paidInAccounts : undefined}
              onSave={updateInvoiceBankDetailsAction.bind(null, invoice.id)}
            />
          </SideSection>

          {isEditable && canEdit && (
            <SideSection
              title="NCF / Vencimiento"
              info="Comprobante fiscal y fecha de vencimiento. Se editan mientras la factura está en Borrador."
            >
              <InvoiceHeaderForm invoice={invoice} paymentTerms={paymentTerms} />
            </SideSection>
          )}

          <SideSection
            title="Gestión de cobro"
            info="Quién da seguimiento al cobro y las gestiones hechas (llamadas, correos, WhatsApp…)."
            summary={collectionSummary}
            defaultOpen={isOpen}
          >
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
          </SideSection>
        </aside>
      </div>
    </main>
  );
}
