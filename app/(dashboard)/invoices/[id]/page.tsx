import Link from "next/link";
import { InfoHint } from "@/components/ui/info-hint";
import { getReminderRecipient } from "@/features/reminders/queries";
import { FlowSteps } from "@/components/documents/flow-steps";
import { getProjectBilling } from "@/features/projects/queries";
import { billingProgress } from "@/features/projects/billing-progress";
import { BillingNotice } from "@/components/projects/billing-notice";
import { safeReturnTo, returnToLabel } from "@/lib/utils/return-to";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Copy,
  Send,
  Building2,
  AlertTriangle,
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
import { ChangeClientButton } from "@/components/documents/change-client-button";
import { listActiveClients } from "@/features/quotations/queries";
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
import { ApplyAdvancesForm } from "./apply-advances-form";
import { CopyProjectLinesButton } from "./copy-project-lines-button";
import { listApplicableAdvances, listInvoiceAdvanceApplications, advanceTargetOf } from "@/features/advances/queries";
import { VoidApplicationButton } from "@/components/advances/void-application-button";
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

/** Pasos de la factura con su explicación (se ven en "Avance de la factura"). */
const INVOICE_FLOW = [
  {
    label: "Borrador",
    sub: "En preparación · editable",
    help: "La factura se está preparando: agrega o quita líneas, cambia el cliente, la comisión o el vencimiento. Todavía no cuenta como venta ni se puede cobrar. Pasa a Emitida al pulsar «Emitir factura».",
  },
  {
    label: "Emitida",
    sub: "Oficial · por cobrar",
    help: "La factura ya es oficial y queda fija: no se pueden cambiar líneas, montos ni cliente (para corregir se cancela o se hace nota de crédito). Cuenta como facturado y corre el vencimiento. Envíasela al cliente y registra los cobros. Si vence sin pagar se marca en rojo.",
  },
  {
    label: "Pago parcial",
    sub: "El cliente pagó una parte",
    help: "Se registró un cobro (o retenciones del cliente) por menos del total. El «Balance pendiente» es lo que falta. Este paso cambia solo al registrar un cobro.",
  },
  {
    label: "Pagada",
    sub: "Balance en cero",
    help: "Se cobró todo (dinero recibido + retenciones del cliente). No queda nada pendiente. Cambia sola cuando el balance llega a cero.",
  },
] as const;

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
  // Anticipos (V1-3): los que se pueden aplicar a esta factura y los ya aplicados.
  const invoiceOpen = ["ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(invoice.status) && invoice.balance > 0;
  const [applicableAdvances, advanceApplications] = await Promise.all([
    invoiceOpen && canPay
      ? listApplicableAdvances({
          client_id: invoice.client_id,
          project_id: invoice.project_id,
          quotation_id: (invoice as { quotation_id?: string | null }).quotation_id ?? null,
          currency: invoice.currency,
        }).catch(() => [])
      : Promise.resolve([]),
    invoice.status !== "DRAFT" ? listInvoiceAdvanceApplications(id).catch(() => []) : Promise.resolve([]),
  ]);
  const activeApplications = advanceApplications.filter((a) => a.status === "ACTIVE");
  const appliedAdvances = activeApplications.reduce((acc, a) => acc + Number(a.amount), 0);
  // «Anticipo de cliente» no se elige en un cobro: un anticipo se registra aparte (recibo ANT).
  const paymentCategories = categories.filter(
    (c) => c.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase() !== "anticipo de cliente",
  );
  const advanceScope = invoice.project_id
    ? "Este proyecto"
    : (invoice as { quotation_id?: string | null }).quotation_id
      ? "Esta cotización"
      : "Este cliente";
  // Para "Cambiar cliente" (solo en Borrador).
  const activeClients = invoice.status === "DRAFT" && canEdit ? await listActiveClients() : [];
  // Borrador de un proyecto: "con esta factura quedaría por facturar…" (solo aviso).
  const projectBilling =
    invoice.status === "DRAFT" && invoice.project_id
      ? await getProjectBilling(invoice.project_id)
          .then((b) =>
            billingProgress({
              cotizado: b.cotizado,
              facturado: b.facturado,
              borradores: Number(invoice.total ?? 0) * Number(invoice.exchange_rate ?? 1),
            }),
          )
          .catch(() => null)
      : null;

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
  const quotationData = (invoice as { origin_quotation?: unknown }).origin_quotation as
    | { number: string }
    | { number: string }[]
    | null
    | undefined;
  const originQuotation = (Array.isArray(quotationData) ? quotationData[0] : quotationData)?.number ?? null;

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
  // Algún cobro entró en una cuenta de otra moneda o con comisión del banco.
  const anyBankDetail = payments.some(
    (p) => (p.account_currency && p.account_currency !== invoice.currency) || Number(p.bank_fee_amount ?? 0) > 0,
  );
  const paymentColumns: Column<PaymentRow>[] = [
    { header: "Fecha", accessor: (p) => <RegisteredDate date={p.payment_date} createdAt={p.created_at} className="text-brand-text" /> },
    {
      // Con retenciones: lo que entró al banco (moneda de la factura).
      header: hasWithholdings ? (anyBankDetail ? "Recibido" : "Recibido en banco") : "Monto",
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
    ...(anyBankDetail ? [{
      // Multimoneda V5: cobro recibido en una cuenta en otra moneda (o con comisión).
      // Solo se muestra si algún cobro lo necesita (si no, sería una columna de "—").
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
    } as Column<PaymentRow>] : []),
    {
      // Cuenta, método y referencia juntos para que la tabla quepa sin barra de desplazamiento.
      header: "Cuenta / método",
      accessor: (p) => {
        const account = p.bank_accounts as
          | { name: string; bank_name: string | null }
          | { name: string; bank_name: string | null }[]
          | null;
        const a = Array.isArray(account) ? account[0] : account;
        return (
          <span className="flex flex-col text-xs">
            <span className="whitespace-nowrap text-sm text-brand-text">{a ? a.name : "Sin banco"}</span>
            <span className="text-brand-muted">
              {PAYMENT_METHOD_LABELS[p.method] ?? p.method}
              {p.reference ? ` · ${p.reference}` : ""}
            </span>
          </span>
        );
      },
    },
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
          ? {
              tone: "next",
              text: invoice.project_id
                ? "pulsa «Copiar todas las líneas pendientes del proyecto» (abajo) o agrega las líneas una por una en Agregar línea."
                : "agrega las líneas de la factura (abajo, en Agregar línea).",
            }
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
  const reminderTo = await getReminderRecipient(invoice.client_id).catch(() => ({ text: null, via: null }));
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
                {invoice.status === "DRAFT" && canEdit && (
                  <dd className="ml-1">
                    <ChangeClientButton
                      kind="invoice"
                      documentId={invoice.id}
                      currentClientId={invoice.client_id}
                      clients={activeClients}
                      blockedReason={
                        invoice.project_id || invoice.quotation_id
                          ? "Esta factura viene de un proyecto o de una cotización del cliente actual, así que no se le puede cambiar el cliente. Descarta este borrador y crea la factura desde cero para el otro cliente."
                          : null
                      }
                    />
                  </dd>
                )}
              </div>
              {/* De dónde viene la factura (proyecto / cotización), bien visible. */}
              {project && invoice.project_id && (
                <div className="flex items-center gap-1.5 rounded-full bg-brand-accent-light px-2.5 py-0.5">
                  <FolderKanban size={14} className="text-brand-accent" aria-hidden />
                  <dt className="text-xs font-medium text-brand-accent">Del proyecto</dt>
                  <dd>
                    <Link href={`/projects/${invoice.project_id}`} className="text-xs font-semibold text-brand-accent hover:underline">
                      {project.number} · {project.name}
                    </Link>
                  </dd>
                </div>
              )}
              {originQuotation && invoice.quotation_id && (
                <div className="flex items-center gap-1.5 rounded-full bg-brand-accent-light px-2.5 py-0.5">
                  <FileText size={14} className="text-brand-accent" aria-hidden />
                  <dt className="text-xs font-medium text-brand-accent">De la cotización</dt>
                  <dd>
                    <Link href={`/quotations/${invoice.quotation_id}`} className="text-xs font-semibold text-brand-accent hover:underline">
                      {originQuotation}
                    </Link>
                  </dd>
                  {!invoice.project_id && <span className="text-xs text-brand-accent">· sin proyecto</span>}
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

        {/* Alerta visible: sin vencimiento no hay recordatorios ni se marca como vencida. */}
        {!invoice.due_date && invoice.status !== "PAID" && invoice.status !== "CANCELLED" && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-[var(--radius-md)] border border-brand-warning/40 bg-brand-warning-bg px-3 py-2.5 text-sm text-brand-text"
          >
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-brand-warning" aria-hidden />
            <span>
              <strong>Esta factura no tiene fecha de vencimiento:</strong> no se le enviarán recordatorios de cobro ni se
              marcará como vencida.{" "}
              {invoice.status === "DRAFT"
                ? "Ponle una condición de pago o una fecha en «NCF / Vencimiento» (a la derecha) antes de emitirla."
                : "Como ya está emitida, el vencimiento no se puede cambiar; dale seguimiento manual en «Gestión de cobro»."}
            </span>
            <InfoHint text="Los recordatorios automáticos (Configuración → Recordatorios) se cuentan desde la fecha de vencimiento: días antes, el día que vence y días después. Sin fecha, la factura no entra en esa lista ni en la de WhatsApp de hoy." />
          </div>
        )}

        {flowIndex >= 0 ? (
          <FlowSteps
            title="Avance de la factura"
            hint="Una factura pasa por estos pasos: se prepara en Borrador, se emite (queda oficial y fija), y luego se va cobrando hasta quedar Pagada. Los pasos 3 y 4 cambian solos al registrar los cobros. El paso en azul es donde está ahora; los verdes ya se cumplieron."
            steps={INVOICE_FLOW.map((step, i) => {
              // "Pagada" es el último: al llegar ya está completo (verde).
              const isPaid = invoice.status === "PAID";
              const done = i < flowIndex || (isPaid && i === flowIndex);
              const current = i === flowIndex && !isPaid;
              const overdue = current && overdueNow;
              return {
                label: overdue ? "Emitida · vencida" : step.label,
                sub: overdue ? "Pasó la fecha de vencimiento" : step.sub,
                help: overdue
                  ? "Pasó la fecha de vencimiento y todavía hay balance pendiente. Anota la gestión de cobro (a la derecha) y registra el cobro cuando el cliente pague."
                  : step.help,
                state: overdue ? "overdue" : done ? "done" : current ? "current" : "todo",
              };
            })}
          />
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
            {canEdit && (
              <DuplicateInvoiceButton
                invoiceId={invoice.id}
                fromQuotation={!invoice.project_id && invoice.quotation_id ? originQuotation : null}
              />
            )}
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
            info: "Lo que ya rebajó el saldo: dinero recibido en banco + retenciones del cliente + anticipos aplicados.",
            note:
              Number(invoice.withholding_total) > 0 || appliedAdvances > 0
                ? [
                    `Recibido ${formatMoney(invoice.paid_amount - Number(invoice.withholding_total) - appliedAdvances, invoice.currency)}`,
                    Number(invoice.withholding_total) > 0
                      ? `Retenciones ${formatMoney(Number(invoice.withholding_total), invoice.currency)}`
                      : null,
                    appliedAdvances > 0 ? `Anticipos ${formatMoney(appliedAdvances, invoice.currency)}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")
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

      {projectBilling && (
        <BillingNotice progress={projectBilling} context="invoice" projectLabel={project?.number} />
      )}

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

            {isEditable && canEdit && invoice.project_id && (
              <div className="flex flex-col gap-1 rounded-[var(--radius-md)] border border-brand-accent/25 bg-brand-accent-light px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-brand-text">
                  <strong>Factura del proyecto {project?.number}:</strong> copia de una vez lo que falta por facturar, con su ITBIS.
                </p>
                <CopyProjectLinesButton invoiceId={invoice.id} projectNumber={project?.number ?? "el proyecto"} />
              </div>
            )}

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
            <DataTable columns={paymentColumns} rows={payments} keyFor={(p) => p.id} maxWidth="max-w-none" emptyMessage={activeApplications.length ? "Sin cobros en dinero todavía (abajo, los anticipos aplicados)." : "Sin cobros registrados todavía."} />

            {advanceApplications.length > 0 && (
              <div className="rounded-[var(--radius-lg)] border border-brand-border bg-brand-surface">
                <p className="flex items-center gap-1 border-b border-brand-border px-4 py-2.5 text-sm font-semibold text-brand-text">
                  Anticipos aplicados
                  <InfoHint text="Dinero que el cliente entregó antes de esta factura (recibos ANT). Rebaja el saldo, pero no mueve el banco: entró el día del anticipo." />
                </p>
                <ul className="divide-y divide-brand-border">
                  {advanceApplications.map((m) => {
                    const adv = relationRow<{ number: string; receipt_date: string }>(m.customer_advances);
                    const voided = m.status === "VOIDED";
                    return (
                      <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
                        <span className={voided ? "text-brand-muted line-through" : "text-brand-text"}>
                          <Link href={`/advances/${m.advance_id}`} className="font-medium text-brand-accent hover:underline">
                            {adv?.number ?? "Anticipo"}
                          </Link>{" "}
                          <span className="text-brand-muted">
                            · recibido {formatDate(adv?.receipt_date ?? m.movement_date)} · aplicado {formatDate(m.movement_date)}
                          </span>
                        </span>
                        {voided && <span className="text-xs text-brand-muted">Quitado: {m.void_reason ?? "—"}</span>}
                        <span className="flex items-center gap-2">
                          <span className={`whitespace-nowrap font-medium tabular-nums ${voided ? "text-brand-muted line-through" : "text-brand-success"}`}>
                            {formatMoney(Number(m.amount), invoice.currency)}
                          </span>
                          {!voided && canVoid && invoice.status !== "CANCELLED" && (
                            <VoidApplicationButton
                              movementId={m.id}
                              amount={Number(m.amount)}
                              currency={invoice.currency}
                              advanceNumber={adv?.number ?? "anticipo"}
                              invoiceNumber={invoice.number}
                            />
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {applicableAdvances.length > 0 && (
              <ApplyAdvancesForm
                key={applicableAdvances.map((a) => `${a.id}:${a.available_amount}`).join("|") + `|${invoice.balance}`}
                invoiceId={invoice.id}
                balance={invoice.balance}
                currency={invoice.currency}
                scopeLabel={advanceScope}
                advances={applicableAdvances.map((a) => ({
                  id: a.id,
                  number: a.number,
                  receipt_date: a.receipt_date,
                  available: Number(a.available_amount),
                  target: advanceTargetOf(a).label,
                }))}
              />
            )}

            {["ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(invoice.status) &&
              invoice.balance > 0 &&
              canPay && (
                <Card>
                  <p className="text-sm font-medium text-brand-text">Registrar cobro</p>
                  <p className="mb-3 flex items-center gap-1 text-xs text-brand-muted">
                    {applicableAdvances.length > 0
                      ? "Primero aplica los anticipos (arriba); aquí va solo lo que el cliente pague ahora."
                      : "¿El cliente pagó antes de que existiera esta factura? Eso es un anticipo: se registra en el proyecto o la cotización y aquí se aplica."}
                    <InfoHint text="Anticipo = dinero recibido ANTES de facturar (recibo ANT, sin impuestos). Cobro = dinero recibido de una factura ya emitida (recibo REC). Así no se cobra dos veces." />
                  </p>
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
                      // Si el saldo cambia (ej. al aplicar o quitar un anticipo), el formulario vuelve a empezar con el saldo nuevo.
                      key={`cobro-${invoice.balance}`}
                      invoiceId={invoice.id}
                      clientId={invoice.client_id}
                      projectId={invoice.project_id}
                      balance={invoice.balance}
                      currency={invoice.currency}
                      bankAccounts={bankAccounts}
                      categories={paymentCategories}
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
              <InvoiceHeaderForm
                invoice={invoice}
                paymentTerms={paymentTerms}
                projectEvent={
                  invoice.project_id && project
                    ? { number: project.number, eventDate: (project as { event_date?: string | null }).event_date ?? null }
                    : null
                }
              />
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

            {/* A quién le llegan los recordatorios automáticos (Configuración → Recordatorios). */}
            <div
              className={`mt-3 rounded-[var(--radius-md)] px-3 py-2 text-xs ${
                reminderTo.text ? "bg-brand-surface-hover text-brand-text" : "bg-brand-warning-bg text-brand-text"
              }`}
            >
              <span className="flex items-center gap-1 font-medium">
                Los recordatorios van a:
                <InfoHint text="Los recordatorios de cobro (correo automático y WhatsApp) van a los contactos del cliente marcados «Recibe recordatorios de cobro» (ej. el contable). Si no hay ninguno, al correo registrado del cliente. Se cambia en la ficha del cliente, en Contactos." />
              </span>
              <span className="block break-words">
                {reminderTo.text ?? "nadie: el cliente no tiene correo ni contactos de cobros con correo."}
              </span>
              {!invoice.due_date && (
                <span className="mt-1 block font-medium text-brand-warning">
                  Esta factura no tiene vencimiento: no recibe recordatorios. Ponle una fecha mientras esté en Borrador.
                </span>
              )}
              <Link href={`/clients/${invoice.client_id}`} className="text-brand-accent hover:underline">
                Cambiar en la ficha del cliente
              </Link>
            </div>

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
