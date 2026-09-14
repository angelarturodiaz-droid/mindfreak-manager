import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Send } from "lucide-react";
import {
  getInvoice,
  listInvoiceItems,
  listActiveServices,
  listProjectItemsFor,
} from "@/features/invoices/queries";
import {
  deleteInvoiceItemAction,
  issueInvoiceAction,
  cancelInvoiceAction,
} from "@/features/invoices/actions";
import { listPaymentsForInvoice, listBankAccounts } from "@/features/payments/queries";
import { PAYMENT_METHOD_LABELS } from "@/features/payments/schema";
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

  const [items, services, canEdit, canPay, projectItems, payments, bankAccounts] =
    await Promise.all([
      listInvoiceItems(id),
      listActiveServices(),
      hasPermission("invoices.create"),
      hasPermission("payments.create"),
      invoice.project_id ? listProjectItemsFor(invoice.project_id) : Promise.resolve([]),
      listPaymentsForInvoice(id),
      listBankAccounts(),
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
    {
      header: "Subtotal",
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
    { header: "Referencia", accessor: (p) => <span className="text-brand-muted">{p.reference || "—"}</span> },
  ];

  return (
    <main className="flex flex-1 flex-col gap-8 p-8">
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
            <InvoiceHeaderForm invoice={invoice} />
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
        <DataTable columns={paymentColumns} rows={payments} keyFor={(p) => p.id} maxWidth="max-w-2xl" emptyMessage="Sin cobros registrados todavía." />

        {["ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(invoice.status) &&
          invoice.balance > 0 &&
          canPay && (
            <div className="mt-4">
              <RegisterPaymentForm
                invoiceId={invoice.id}
                clientId={invoice.client_id}
                projectId={invoice.project_id}
                balance={invoice.balance}
                currency={invoice.currency}
                bankAccounts={bankAccounts}
              />
            </div>
          )}
      </section>
    </main>
  );
}
