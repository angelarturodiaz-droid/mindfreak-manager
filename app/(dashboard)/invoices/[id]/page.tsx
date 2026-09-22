import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Send } from "lucide-react";
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
import { getDefaultTaxRate } from "@/features/tax-rates/queries";
import { hasPermission } from "@/lib/auth/permissions";
import { NewInvoiceItemForm } from "./new-item-form";
import { InvoiceHeaderForm } from "./invoice-header-form";
import { RegisterPaymentForm } from "./register-payment-form";
import { InvoiceShareLinkButton } from "./share-link-button";
import { DuplicateInvoiceButton } from "./duplicate-invoice-button";
import { DiscardInvoiceButton } from "./discard-invoice-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { DataTable, type Column } from "@/components/ui/data-table";
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

  const [items, services, canEdit, canPay, projectItems, payments, bankAccounts, paymentTerms, defaultTaxPercent, companyUsers, collectionHistory] =
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
    ]);

  const clientData = invoice.clients as { name: string } | { name: string }[] | null;
  const clientName = Array.isArray(clientData) ? clientData[0]?.name : clientData?.name;
  const projectData = invoice.projects as
    | { number: string; name: string }
    | { number: string; name: string }[]
    | null;
  const project = Array.isArray(projectData) ? projectData[0] : projectData;

  const isEditable = invoice.status === "DRAFT";

  const itemColumns: Column<ItemRow>[] = [
    { header: "Descripción", accessor: (item) => item.description },
    { header: "Cant.", accessor: (item) => item.quantity },
    { header: "Precio", accessor: (item) => formatMoney(item.unit_price, invoice.currency) },
    { header: "Descuento", accessor: (item) => formatMoney(item.discount, invoice.currency) },
    { header: "Impuesto", accessor: (item) => formatMoney(item.tax, invoice.currency) },
    {
      header: "Total",
      accessor: (item) => <span className="font-medium">{formatMoney(item.subtotal, invoice.currency)}</span>,
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
    { header: "Fecha", accessor: (p) => p.payment_date },
    { header: "Monto", accessor: (p) => <span className="font-medium">{formatMoney(p.amount, invoice.currency)}</span> },
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

  return (
    <main className="flex flex-1 flex-col gap-8 p-4 md:p-8">
      <div>
        <Link
          href="/invoices"
          className="inline-flex items-center gap-1 text-sm text-brand-muted hover:text-brand-text"
        >
          <ArrowLeft size={14} /> Facturas
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-xl font-semibold text-brand-primary">
            {invoice.number}
          </h1>
          <Badge status={invoice.status}>{STATUS_LABELS[invoice.status] ?? invoice.status}</Badge>
        </div>
        <p className="text-sm text-brand-muted">
          Cliente: {clientName ?? "—"}
          {project && ` · Proyecto: ${project.number} (${project.name})`}
          {" · "}Emitida: {invoice.issue_date}
          {invoice.due_date && ` · Vence: ${invoice.due_date}`}
          {invoice.payment_terms_id &&
            (() => {
              const ptData = invoice.payment_terms as { name: string } | { name: string }[] | null;
              const ptName = Array.isArray(ptData) ? ptData[0]?.name : ptData?.name;
              return ptName ? ` · Condición: ${ptName}` : "";
            })()}
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        {isEditable && canEdit && (
          <form action={issueInvoiceAction.bind(null, invoice.id)}>
            <Button type="submit" size="sm" className="!bg-brand-success" icon={<Send size={14} />}>
              Emitir factura
            </Button>
          </form>
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
        <InvoiceShareLinkButton invoiceId={invoice.id} />
        {canEdit && <DuplicateInvoiceButton invoiceId={invoice.id} />}
      </div>

      {isEditable && canEdit && (
        <section className="max-w-md">
          <h2 className="mb-3 text-sm font-medium text-brand-text">
            NCF / Vencimiento
          </h2>
          <Card>
            <InvoiceHeaderForm invoice={invoice} paymentTerms={paymentTerms} />
          </Card>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-medium text-brand-text">
          Líneas de factura
        </h2>
        <DataTable columns={itemColumns} rows={items} keyFor={(i) => i.id} maxWidth="max-w-4xl" emptyMessage="Sin líneas todavía." />

        {isEditable && canEdit && (
          <div className="mt-4">
            <NewInvoiceItemForm
              invoiceId={invoice.id}
              services={services}
              projectItems={projectItems}
              defaultTaxPercent={defaultTaxPercent}
            />
          </div>
        )}

        <Card className="mt-6 max-w-sm text-sm">
          <div className="flex items-center justify-between">
            <span className="text-brand-muted">Subtotal</span>
            <span className="font-medium">
              {formatMoney(invoice.subtotal, invoice.currency)}
            </span>
          </div>
          {invoice.commission_percent > 0 && (
            <div className="mt-1 flex items-center justify-between">
              <span className="text-brand-muted">Comisión ({invoice.commission_percent}%)</span>
              <span className="font-medium">
                {formatMoney(invoice.commission_amount, invoice.currency)}
              </span>
            </div>
          )}
          <div className="mt-1 flex items-center justify-between">
            <span className="text-brand-muted">Descuento</span>
            <span className="font-medium">
              -{formatMoney(invoice.discount, invoice.currency)}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-brand-muted">Impuesto</span>
            <span className="font-medium">
              {formatMoney(invoice.tax, invoice.currency)}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-brand-border pt-2 text-base">
            <span className="text-brand-text">Total</span>
            <span className="font-semibold text-brand-primary">
              {formatMoney(invoice.total, invoice.currency)}
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-brand-border pt-2 text-xs text-brand-muted">
            <span>Pagado: {formatMoney(invoice.paid_amount, invoice.currency)}</span>
            <span className="font-medium text-brand-text">
              Balance: {formatMoney(invoice.balance, invoice.currency)}
            </span>
          </div>
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-brand-text">Cobros</h2>
        <DataTable columns={paymentColumns} rows={payments} keyFor={(p) => p.id} maxWidth="max-w-3xl" emptyMessage="Sin cobros registrados todavía." />

        {["ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(invoice.status) &&
          invoice.balance > 0 &&
          canPay && (
            <div className="mt-4">
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
            </div>
          )}
      </section>

      <section className="max-w-2xl">
        <h2 className="mb-2 text-sm font-medium text-brand-text">
          Gestión de cobro
        </h2>
        <Card>
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
              <p className="text-sm text-brand-muted">Sin gestiones registradas todavía.</p>
            ) : (
              <ul className="mb-4 flex flex-col gap-2">
                {collectionHistory.map((h) => {
                  const profileData = h.profiles as { full_name: string | null } | { full_name: string | null }[] | null;
                  const profile = Array.isArray(profileData) ? profileData[0] : profileData;
                  return (
                    <li key={h.id} className="border-b border-brand-border pb-2 text-sm last:border-0">
                      <p className="text-brand-text">
                        <span className="font-medium">{COLLECTION_ACTION_LABELS[h.action] ?? h.action}</span>
                        {" · "}
                        {h.action_date}
                        {" · "}
                        {profile?.full_name ?? "—"}
                      </p>
                      {h.comment && <p className="text-brand-muted">{h.comment}</p>}
                      {h.result && <p className="text-xs text-brand-muted">Resultado: {h.result}</p>}
                      {h.next_action_date && (
                        <p className="text-xs text-brand-muted">Próxima acción: {h.next_action_date}</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            <AddCollectionHistoryForm invoiceId={invoice.id} />
          </div>
        </Card>
      </section>
    </main>
  );
}
