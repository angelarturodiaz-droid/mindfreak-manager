import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Send, Check, X, ArrowRightCircle, Eye } from "lucide-react";
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
import { getDefaultTaxRate } from "@/features/tax-rates/queries";
import { NewItemForm } from "./new-item-form";
import { ShareLinkButton } from "./share-link-button";
import { DuplicateQuotationButton } from "./duplicate-quotation-button";
import { DiscardQuotationButton } from "./discard-quotation-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { DataTable, type Column } from "@/components/ui/data-table";

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

type Item = Awaited<ReturnType<typeof listQuotationItems>>[number];

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

  const [items, services, canUpdate, canApprove, defaultTaxPercent] = await Promise.all([
    listQuotationItems(id),
    listActiveServices(),
    hasPermission("quotations.update"),
    hasPermission("quotations.approve"),
    getDefaultTaxRate(),
  ]);

  const clientData = quotation.clients as { name: string } | { name: string }[] | null;
  const clientName = Array.isArray(clientData) ? clientData[0]?.name : clientData?.name;

  const isEditable = quotation.status === "DRAFT" || quotation.status === "NEGOTIATING";

  const columns: Column<Item>[] = [
    { header: "Descripción", accessor: (item) => item.description },
    { header: "Cant.", accessor: (item) => item.quantity },
    { header: "Precio", accessor: (item) => formatMoney(item.unit_price, quotation.currency) },
    { header: "Descuento", accessor: (item) => formatMoney(item.discount, quotation.currency) },
    {
      header: "Subtotal",
      accessor: (item) => (
        <span className="font-medium">{formatMoney(item.subtotal, quotation.currency)}</span>
      ),
    },
    {
      header: "",
      className: "text-right",
      accessor: (item) =>
        isEditable && canUpdate ? (
          <ConfirmButton
            label="Eliminar"
            confirmTitle="¿Eliminar esta línea?"
            onConfirm={deleteQuotationItemAction.bind(null, item.id, quotation.id)}
          />
        ) : null,
    },
  ];

  return (
    <main className="flex flex-1 flex-col gap-8 p-8">
      <div>
        <Link
          href="/quotations"
          className="inline-flex items-center gap-1 text-sm text-brand-muted hover:text-brand-text"
        >
          <ArrowLeft size={14} /> Cotizaciones
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-xl font-semibold text-brand-primary">
            {quotation.number}
          </h1>
          <Badge status={quotation.status}>
            {STATUS_LABELS[quotation.status] ?? quotation.status}
          </Badge>
        </div>
        <p className="text-sm text-brand-muted">
          Cliente: {clientName ?? "—"} · Emitida: {quotation.issue_date}
          {quotation.valid_until && ` · Válida hasta: ${quotation.valid_until}`}
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        {quotation.status === "DRAFT" && canUpdate && (
          <form action={sendQuotationAction.bind(null, quotation.id)}>
            <Button type="submit" variant="secondary" size="sm" icon={<Send size={14} />}>
              Marcar como enviada
            </Button>
          </form>
        )}
        {(quotation.status === "SENT" ||
          quotation.status === "VIEWED" ||
          quotation.status === "NEGOTIATING") &&
          canApprove && (
            <>
              <form action={approveQuotationAction.bind(null, quotation.id)}>
                <Button type="submit" size="sm" icon={<Check size={14} />} className="!bg-brand-success">
                  Aprobar
                </Button>
              </form>
              <form action={rejectQuotationAction.bind(null, quotation.id)}>
                <Button type="submit" variant="danger" size="sm" icon={<X size={14} />}>
                  Rechazar
                </Button>
              </form>
            </>
          )}
        {!["APPROVED", "CANCELLED", "REJECTED"].includes(quotation.status) &&
          canUpdate && (
            <ConfirmButton
              label="Cancelar cotización"
              confirmTitle="¿Cancelar esta cotización?"
              confirmMessage="Se conserva el registro para auditoría, pero ya no se podrá editar."
              onConfirm={cancelQuotationAction.bind(null, quotation.id)}
            />
          )}
        {quotation.status === "DRAFT" && canUpdate && (
          <DiscardQuotationButton quotationId={quotation.id} />
        )}
        <ShareLinkButton quotationId={quotation.id} />
        {canUpdate && <DuplicateQuotationButton quotationId={quotation.id} />}
        {quotation.status === "APPROVED" && !quotation.project_id && (
          <Link href={`/projects/from-quotation/${quotation.id}`}>
            <Button variant="secondary" size="sm" className="!bg-brand-success" icon={<ArrowRightCircle size={14} />}>
              Convertir a Proyecto
            </Button>
          </Link>
        )}
        {quotation.project_id && (
          <Link href={`/projects/${quotation.project_id}`}>
            <Button variant="outline" size="sm" icon={<Eye size={14} />}>
              Ver proyecto
            </Button>
          </Link>
        )}
      </div>

      <section>
        <h2 className="mb-3 text-sm font-medium text-brand-text">
          Líneas de servicio
        </h2>
        <DataTable columns={columns} rows={items} keyFor={(i) => i.id} maxWidth="max-w-4xl" emptyMessage="Sin líneas todavía." />

        {isEditable && canUpdate && (
          <div className="mt-4">
            <NewItemForm quotationId={quotation.id} services={services} defaultTaxPercent={defaultTaxPercent} />
          </div>
        )}

        <Card className="mt-6 max-w-sm text-sm">
          <div className="flex items-center justify-between">
            <span className="text-brand-muted">Subtotal</span>
            <span className="font-medium">
              {formatMoney(quotation.subtotal, quotation.currency)}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-brand-muted">Descuento</span>
            <span className="font-medium">
              -{formatMoney(quotation.discount, quotation.currency)}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-brand-muted">Impuesto</span>
            <span className="font-medium">
              {formatMoney(quotation.tax, quotation.currency)}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-brand-border pt-2 text-base">
            <span className="text-brand-text">Total</span>
            <span className="font-semibold text-brand-primary">
              {formatMoney(quotation.total, quotation.currency)}
            </span>
          </div>
          <p className="mt-3 border-t border-brand-border pt-2 text-xs text-brand-muted">
            Costo estimado: {formatMoney(quotation.estimated_cost, quotation.currency)}
            {" · "}
            Margen estimado: {quotation.estimated_margin?.toFixed(1) ?? "0.0"}%
          </p>
        </Card>
      </section>

      {quotation.payment_terms_id && (
        <section className="max-w-2xl">
          <h2 className="mb-1 text-sm font-medium text-brand-text">
            Condición de pago
          </h2>
          <p className="text-sm text-brand-muted">
            {(() => {
              const pt = quotation.payment_terms as { name: string } | { name: string }[] | null;
              const name = Array.isArray(pt) ? pt[0]?.name : pt?.name;
              return name ?? "—";
            })()}
            {" · "}
            {quotation.credit_days} días de crédito
            {" · "}
            {quotation.advance_percent}% anticipo / {quotation.balance_percent}% saldo
          </p>
        </section>
      )}

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
