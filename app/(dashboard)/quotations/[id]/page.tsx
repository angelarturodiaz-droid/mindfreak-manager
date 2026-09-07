import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getQuotation,
  listQuotationItems,
  listActiveServices,
} from "@/features/quotations/queries";
import {
  deleteQuotationItemAction,
  sendQuotationAction,
  approveQuotationAction,
  rejectQuotationAction,
  cancelQuotationAction,
} from "@/features/quotations/actions";
import { hasPermission } from "@/lib/auth/permissions";
import { NewItemForm } from "./new-item-form";
import { ShareLinkButton } from "./share-link-button";

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency }).format(
    amount,
  );
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  SENT: "Enviada",
  VIEWED: "Vista",
  NEGOTIATING: "Negociando",
  APPROVED: "Aprobada",
  REJECTED: "Rechazada",
  EXPIRED: "Expirada",
  CANCELLED: "Cancelada",
};

export default async function QuotationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let quotation;
  try {
    quotation = await getQuotation(id);
  } catch {
    notFound();
  }
  if (!quotation) notFound();

  const [items, services, canUpdate, canApprove] = await Promise.all([
    listQuotationItems(id),
    listActiveServices(),
    hasPermission("quotations.update"),
    hasPermission("quotations.approve"),
  ]);

  const clientData = quotation.clients as { name: string } | { name: string }[] | null;
  const clientName = Array.isArray(clientData) ? clientData[0]?.name : clientData?.name;

  const isEditable = quotation.status === "DRAFT" || quotation.status === "NEGOTIATING";

  return (
    <main className="flex flex-1 flex-col gap-8 p-8">
      <div>
        <Link href="/quotations" className="text-sm text-brand-muted hover:text-brand-text">
          ← Cotizaciones
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-xl font-semibold text-brand-primary">
            {quotation.number}
          </h1>
          <span className="text-brand-accent">
            {STATUS_LABELS[quotation.status] ?? quotation.status}
          </span>
        </div>
        <p className="text-sm text-brand-muted">
          Cliente: {clientName ?? "—"} · Emitida: {quotation.issue_date}
          {quotation.valid_until && ` · Válida hasta: ${quotation.valid_until}`}
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        {quotation.status === "DRAFT" && canUpdate && (
          <form action={sendQuotationAction.bind(null, quotation.id)}>
            <button
              type="submit"
              className="border border-brand-accent px-4 py-2 text-sm text-brand-accent hover:bg-brand-accent hover:text-white"
            >
              Marcar como enviada
            </button>
          </form>
        )}
        {(quotation.status === "SENT" ||
          quotation.status === "VIEWED" ||
          quotation.status === "NEGOTIATING") &&
          canApprove && (
            <>
              <form action={approveQuotationAction.bind(null, quotation.id)}>
                <button
                  type="submit"
                  className="border border-brand-success px-4 py-2 text-sm text-brand-success hover:bg-brand-success hover:text-white"
                >
                  Aprobar
                </button>
              </form>
              <form action={rejectQuotationAction.bind(null, quotation.id)}>
                <button
                  type="submit"
                  className="border border-brand-danger px-4 py-2 text-sm text-brand-danger hover:bg-brand-danger hover:text-white"
                >
                  Rechazar
                </button>
              </form>
            </>
          )}
        {!["APPROVED", "CANCELLED", "REJECTED"].includes(quotation.status) &&
          canUpdate && (
            <form action={cancelQuotationAction.bind(null, quotation.id)}>
              <button
                type="submit"
                className="border border-brand-muted/30 px-4 py-2 text-sm text-brand-muted hover:border-brand-danger hover:text-brand-danger"
              >
                Cancelar cotización
              </button>
            </form>
          )}
        <ShareLinkButton quotationId={quotation.id} />
      </div>

      <section>
        <h2 className="mb-3 text-sm font-medium text-brand-text">
          Líneas de servicio
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
                  {formatMoney(item.unit_price, quotation.currency)}
                </td>
                <td className="py-2">
                  {formatMoney(item.discount, quotation.currency)}
                </td>
                <td className="py-2 font-medium">
                  {formatMoney(item.subtotal, quotation.currency)}
                </td>
                <td className="py-2 text-right">
                  {isEditable && canUpdate && (
                    <form
                      action={deleteQuotationItemAction.bind(
                        null,
                        item.id,
                        quotation.id,
                      )}
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

        {isEditable && canUpdate && (
          <div className="mt-4">
            <NewItemForm quotationId={quotation.id} services={services} />
          </div>
        )}

        <div className="mt-6 flex max-w-4xl flex-col items-end gap-1 text-sm">
          <p>
            Subtotal:{" "}
            <span className="font-medium">
              {formatMoney(quotation.subtotal, quotation.currency)}
            </span>
          </p>
          <p>
            Descuento:{" "}
            <span className="font-medium">
              -{formatMoney(quotation.discount, quotation.currency)}
            </span>
          </p>
          <p>
            Impuesto:{" "}
            <span className="font-medium">
              {formatMoney(quotation.tax, quotation.currency)}
            </span>
          </p>
          <p className="text-base">
            Total:{" "}
            <span className="font-semibold text-brand-primary">
              {formatMoney(quotation.total, quotation.currency)}
            </span>
          </p>
          <p className="text-brand-muted">
            Costo estimado: {formatMoney(quotation.estimated_cost, quotation.currency)}
            {" · "}
            Margen estimado: {quotation.estimated_margin?.toFixed(1) ?? "0.0"}%
          </p>
        </div>
      </section>

      {quotation.terms && (
        <section className="max-w-2xl">
          <h2 className="mb-1 text-sm font-medium text-brand-text">
            Condiciones
          </h2>
          <p className="text-sm text-brand-muted">{quotation.terms}</p>
        </section>
      )}
    </main>
  );
}
