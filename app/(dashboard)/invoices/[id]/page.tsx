import Link from "next/link";
import { notFound } from "next/navigation";
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
import { hasPermission } from "@/lib/auth/permissions";
import { NewInvoiceItemForm } from "./new-item-form";
import { InvoiceHeaderForm } from "./invoice-header-form";

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

  const [items, services, canEdit, projectItems] = await Promise.all([
    listInvoiceItems(id),
    listActiveServices(),
    hasPermission("invoices.create"),
    invoice.project_id ? listProjectItemsFor(invoice.project_id) : Promise.resolve([]),
  ]);

  const clientData = invoice.clients as { name: string } | { name: string }[] | null;
  const clientName = Array.isArray(clientData) ? clientData[0]?.name : clientData?.name;
  const projectData = invoice.projects as
    | { number: string; name: string }
    | { number: string; name: string }[]
    | null;
  const project = Array.isArray(projectData) ? projectData[0] : projectData;

  const isEditable = invoice.status === "DRAFT";

  return (
    <main className="flex flex-1 flex-col gap-8 p-8">
      <div>
        <Link href="/invoices" className="text-sm text-brand-muted hover:text-brand-text">
          ← Facturas
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-xl font-semibold text-brand-primary">
            {invoice.number}
          </h1>
          <span className="text-brand-accent">
            {STATUS_LABELS[invoice.status] ?? invoice.status}
          </span>
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
            <button
              type="submit"
              className="border border-brand-success px-4 py-2 text-sm text-brand-success hover:bg-brand-success hover:text-white"
            >
              Emitir factura
            </button>
          </form>
        )}
        {invoice.status !== "CANCELLED" &&
          invoice.status !== "PAID" &&
          canEdit && (
            <form action={cancelInvoiceAction.bind(null, invoice.id)}>
              <button
                type="submit"
                className="border border-brand-muted/30 px-4 py-2 text-sm text-brand-muted hover:border-brand-danger hover:text-brand-danger"
              >
                Cancelar factura
              </button>
            </form>
          )}
      </div>

      {isEditable && canEdit && (
        <section className="max-w-md">
          <h2 className="mb-3 text-sm font-medium text-brand-text">
            NCF / Vencimiento
          </h2>
          <InvoiceHeaderForm invoice={invoice} />
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-medium text-brand-text">
          Líneas de factura
        </h2>
        <table className="w-full max-w-4xl border-collapse text-sm">
          <thead>
            <tr className="border-b border-brand-muted/30 text-left text-brand-muted">
              <th className="py-2 font-medium">Descripción</th>
              <th className="py-2 font-medium">Cant.</th>
              <th className="py-2 font-medium">Precio</th>
              <th className="py-2 font-medium">Descuento</th>
              <th className="py-2 font-medium">Subtotal</th>
              <th className="py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-brand-muted/10">
                <td className="py-2">{item.description}</td>
                <td className="py-2">{item.quantity}</td>
                <td className="py-2">
                  {formatMoney(item.unit_price, invoice.currency)}
                </td>
                <td className="py-2">
                  {formatMoney(item.discount, invoice.currency)}
                </td>
                <td className="py-2 font-medium">
                  {formatMoney(item.subtotal, invoice.currency)}
                </td>
                <td className="py-2 text-right">
                  {isEditable && canEdit && (
                    <form
                      action={deleteInvoiceItemAction.bind(null, item.id, invoice.id)}
                    >
                      <button
                        type="submit"
                        className="text-brand-muted hover:text-brand-danger"
                      >
                        Eliminar
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="py-4 text-center text-brand-muted">
                  Sin líneas todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {isEditable && canEdit && (
          <div className="mt-4">
            <NewInvoiceItemForm
              invoiceId={invoice.id}
              services={services}
              projectItems={projectItems}
            />
          </div>
        )}

        <div className="mt-6 flex max-w-4xl flex-col items-end gap-1 text-sm">
          <p>
            Subtotal:{" "}
            <span className="font-medium">
              {formatMoney(invoice.subtotal, invoice.currency)}
            </span>
          </p>
          <p>
            Descuento:{" "}
            <span className="font-medium">
              -{formatMoney(invoice.discount, invoice.currency)}
            </span>
          </p>
          <p>
            Impuesto:{" "}
            <span className="font-medium">
              {formatMoney(invoice.tax, invoice.currency)}
            </span>
          </p>
          <p className="text-base">
            Total:{" "}
            <span className="font-semibold text-brand-primary">
              {formatMoney(invoice.total, invoice.currency)}
            </span>
          </p>
          <p className="text-brand-muted">
            Pagado: {formatMoney(invoice.paid_amount, invoice.currency)} · Balance:{" "}
            <span className="font-medium text-brand-text">
              {formatMoney(invoice.balance, invoice.currency)}
            </span>
          </p>
        </div>
      </section>
    </main>
  );
}
