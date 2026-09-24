import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Copy,
  Send,
  Check,
  X,
  ArrowRightCircle,
  Eye,
  Building2,
  CalendarDays,
  Clock,
  FolderKanban,
} from "lucide-react";
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
import { getDefaultTaxRate, listTaxRates } from "@/features/tax-rates/queries";
import { TAX_TREATMENT_LABELS } from "@/features/tax-rates/schema";
import { NewItemForm } from "./new-item-form";
import { ShareLinkButton } from "./share-link-button";
import { DuplicateQuotationButton } from "./duplicate-quotation-button";
import { DiscardQuotationButton } from "./discard-quotation-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { ActionButton } from "@/components/ui/action-button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Chip, SectionHeader } from "@/components/ui/page-kit";
import { relationName } from "@/lib/utils/relation";
import { daysFromToday, formatDate, pluralDays } from "@/lib/utils/dates";

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

  const [items, services, canUpdate, canApprove, defaultTaxRate, taxRates] = await Promise.all([
    listQuotationItems(id),
    listActiveServices(),
    hasPermission("quotations.update"),
    hasPermission("quotations.approve"),
    getDefaultTaxRate(),
    listTaxRates(),
  ]);

  const clientData = quotation.clients as { name: string } | { name: string }[] | null;
  const clientName = Array.isArray(clientData) ? clientData[0]?.name : clientData?.name;

  const duplicatedFromData = quotation.duplicated_from as { number: string } | { number: string }[] | null;
  const duplicatedFromNumber = Array.isArray(duplicatedFromData)
    ? duplicatedFromData[0]?.number
    : duplicatedFromData?.number;

  const isEditable = quotation.status === "DRAFT" || quotation.status === "NEGOTIATING";

  const columns: Column<Item>[] = [
    { header: "Descripción", accessor: (item) => item.description },
    { header: "Cant.", className: "text-right", accessor: (item) => <span className="tabular-nums">{item.quantity}</span> },
    { header: "Precio", className: "text-right", accessor: (item) => <span className="tabular-nums">{formatMoney(item.unit_price, quotation.currency)}</span> },
    {
      header: "Descuento",
      className: "text-right",
      accessor: (item) =>
        item.discount > 0 ? (
          <span className="tabular-nums">-{formatMoney(item.discount, quotation.currency)}</span>
        ) : (
          <span className="text-brand-muted">—</span>
        ),
    },
    {
      header: "Impuesto",
      accessor: (item) => (
        <span>
          {formatMoney(item.tax, quotation.currency)}{" "}
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
      accessor: (item) => (
        <span className="font-medium tabular-nums">{formatMoney(item.subtotal, quotation.currency)}</span>
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

  const pt = relationName(quotation.payment_terms);
  const flowIndex =
    quotation.status === "DRAFT"
      ? 0
      : ["SENT", "VIEWED", "NEGOTIATING"].includes(quotation.status)
        ? 1
        : quotation.status === "APPROVED"
          ? quotation.project_id
            ? 3
            : 2
          : -1;
  const FLOW = ["Borrador", "Enviada", "Aprobada", "Proyecto"];
  const closedLabel: Record<string, string> = {
    REJECTED: "Esta cotización fue rechazada por el cliente.",
    CANCELLED: "Esta cotización fue cancelada. Se conserva para auditoría.",
    EXPIRED: "Esta cotización expiró.",
  };
  const validity =
    quotation.valid_until && !["APPROVED", "REJECTED", "CANCELLED"].includes(quotation.status)
      ? daysFromToday(quotation.valid_until)
      : null;

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-8">
      <Link
        href="/quotations"
        className="inline-flex w-fit items-center gap-1 text-sm text-brand-muted hover:text-brand-text"
      >
        <ArrowLeft size={14} /> Cotizaciones
      </Link>

      <Card className="flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-brand-primary">
                {quotation.number}
              </h1>
              <Badge status={quotation.status}>
                {STATUS_LABELS[quotation.status] ?? quotation.status}
              </Badge>
              {quotation.duplicated_from_id && (
                <Badge tone="neutral">
                  <Copy size={12} className="shrink-0" aria-hidden="true" />
                  Duplicada
                  {duplicatedFromNumber && (
                    <>
                      {" de "}
                      <Link
                        href={`/quotations/${quotation.duplicated_from_id}`}
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
                  <Link href={`/clients/${quotation.client_id}`} className="font-medium text-brand-text hover:text-brand-accent">
                    {clientName ?? "—"}
                  </Link>
                </dd>
              </div>
              <div className="flex items-center gap-1.5">
                <CalendarDays size={15} className="text-brand-muted" aria-hidden />
                <dt className="sr-only">Emitida</dt>
                <dd className="text-brand-text">Emitida {formatDate(quotation.issue_date)}</dd>
              </div>
              {quotation.valid_until && (
                <div className="flex items-center gap-1.5">
                  <Clock size={15} className="text-brand-muted" aria-hidden />
                  <dt className="sr-only">Válida hasta</dt>
                  <dd className="flex items-center gap-2 text-brand-text">
                    Válida hasta {formatDate(quotation.valid_until)}
                    {validity !== null && (
                      <Chip tone={validity < 0 ? "danger" : validity <= 3 ? "warning" : "muted"}>
                        {validity < 0
                          ? `Venció hace ${pluralDays(-validity)}`
                          : validity === 0
                            ? "Vence hoy"
                            : `Quedan ${pluralDays(validity)}`}
                      </Chip>
                    )}
                  </dd>
                </div>
              )}
              {quotation.project_id && (
                <div className="flex items-center gap-1.5">
                  <FolderKanban size={15} className="text-brand-muted" aria-hidden />
                  <dt className="sr-only">Proyecto</dt>
                  <dd>
                    <Link href={`/projects/${quotation.project_id}`} className="text-brand-accent hover:underline">
                      Ver proyecto
                    </Link>
                  </dd>
                </div>
              )}
            </dl>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-xs font-medium uppercase tracking-wide text-brand-muted">Total</p>
            <p className="text-2xl font-semibold tracking-tight tabular-nums text-brand-primary">
              {formatMoney(quotation.total, quotation.currency)}
            </p>
          </div>
        </div>

        {flowIndex >= 0 ? (
          <ol className="grid grid-cols-2 gap-2 border-t border-brand-border pt-5 sm:grid-cols-4" aria-label="Avance de la cotización">
            {FLOW.map((label, i) => {
              const done = i < flowIndex;
              const current = i === flowIndex;
              return (
                <li
                  key={label}
                  aria-current={current ? "step" : undefined}
                  className={`flex items-center gap-2.5 rounded-[var(--radius-md)] border px-3 py-2.5 ${
                    current ? "border-brand-accent/40 bg-brand-accent-light" : "border-brand-border bg-brand-surface"
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                      done
                        ? "bg-brand-success text-white"
                        : current
                          ? "bg-brand-accent text-white"
                          : "border border-brand-border text-brand-muted"
                    }`}
                  >
                    {done ? <Check size={14} /> : i + 1}
                  </span>
                  <span className={`text-sm ${current ? "font-semibold text-brand-text" : done ? "text-brand-text" : "text-brand-muted"}`}>
                    {label}
                  </span>
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="rounded-[var(--radius-md)] bg-brand-danger-bg px-4 py-3 text-sm font-medium text-brand-danger">
            {closedLabel[quotation.status] ?? STATUS_LABELS[quotation.status]}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-brand-border pt-4">
          <div className="flex flex-wrap gap-2">
            {quotation.status === "DRAFT" && canUpdate && (
              <ActionButton
                label="Marcar como enviada"
                variant="primary"
                icon={<Send size={14} />}
                onAction={sendQuotationAction.bind(null, quotation.id)}
              />
            )}
            {(quotation.status === "SENT" ||
              quotation.status === "VIEWED" ||
              quotation.status === "NEGOTIATING") &&
              canApprove && (
                <>
                  <ActionButton
                    label="Aprobar"
                    variant="primary"
                    icon={<Check size={14} />}
                    className="!bg-brand-success"
                    onAction={approveQuotationAction.bind(null, quotation.id)}
                  />
                  <ActionButton
                    label="Rechazar"
                    variant="danger"
                    icon={<X size={14} />}
                    onAction={rejectQuotationAction.bind(null, quotation.id)}
                  />
                </>
              )}
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
          <div className="flex flex-wrap items-center gap-2">
            <ShareLinkButton quotationId={quotation.id} />
            {canUpdate && <DuplicateQuotationButton quotationId={quotation.id} />}
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
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="flex min-w-0 flex-col gap-4 lg:col-span-2">
          <SectionHeader
            title="Líneas de servicio"
            count={items.length}
            description={isEditable ? undefined : "Solo se pueden editar en Borrador o Negociando."}
          />
          <DataTable columns={columns} rows={items} keyFor={(i) => i.id} maxWidth="max-w-none" emptyMessage="Sin líneas todavía." />

          {isEditable && canUpdate && (
            <Card>
              <p className="mb-3 text-sm font-medium text-brand-text">Agregar línea</p>
              <NewItemForm quotationId={quotation.id} services={services} defaultTaxRate={defaultTaxRate} taxRates={taxRates} />
            </Card>
          )}
        </section>

        <aside className="flex flex-col gap-4">
          <Card className="text-sm lg:sticky lg:top-4">
            <p className="mb-3 text-sm font-semibold text-brand-text">Resumen</p>
            <div className="flex items-center justify-between">
              <span className="text-brand-muted">Subtotal</span>
              <span className="font-medium tabular-nums">
                {formatMoney(quotation.subtotal, quotation.currency)}
              </span>
            </div>
            {quotation.commission_percent > 0 && (
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <span className="text-brand-muted">
                  Comisión ({quotation.commission_percent}%){" "}
                  <span className="text-xs">
                    (
                    {TAX_TREATMENT_LABELS[quotation.commission_tax_treatment as keyof typeof TAX_TREATMENT_LABELS] ??
                      quotation.commission_tax_treatment}
                    )
                  </span>
                </span>
                <span className="font-medium tabular-nums">
                  {formatMoney(quotation.commission_amount, quotation.currency)}
                </span>
              </div>
            )}
            <div className="mt-1.5 flex items-center justify-between">
              <span className="text-brand-muted">Descuento</span>
              <span className="font-medium tabular-nums">
                -{formatMoney(quotation.discount, quotation.currency)}
              </span>
            </div>
            <div className="mt-1.5 flex items-center justify-between">
              <span className="text-brand-muted">Impuesto</span>
              <span className="font-medium tabular-nums">
                {formatMoney(quotation.tax, quotation.currency)}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-brand-border pt-3 text-base">
              <span className="font-medium text-brand-text">Total</span>
              <span className="text-lg font-semibold tabular-nums text-brand-primary">
                {formatMoney(quotation.total, quotation.currency)}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-brand-border pt-3 text-xs">
              <div>
                <p className="text-brand-muted">Costo estimado</p>
                <p className="font-medium tabular-nums text-brand-text">
                  {formatMoney(quotation.estimated_cost, quotation.currency)}
                </p>
              </div>
              <div>
                <p className="text-brand-muted">Margen estimado</p>
                <p className="font-medium tabular-nums text-brand-text">
                  {quotation.estimated_margin?.toFixed(1) ?? "0.0"}%
                </p>
              </div>
            </div>
          </Card>

          {quotation.payment_terms_id && (
            <Card className="text-sm">
              <p className="mb-2 text-sm font-semibold text-brand-text">Condición de pago</p>
              <p className="text-brand-text">{pt ?? "—"}</p>
              <p className="mt-1 text-brand-muted">
                {quotation.credit_days} días de crédito · {quotation.advance_percent}% anticipo /{" "}
                {quotation.balance_percent}% saldo
              </p>
            </Card>
          )}

          {quotation.terms && (
            <Card className="text-sm">
              <p className="mb-2 text-sm font-semibold text-brand-text">Condiciones</p>
              <p className="whitespace-pre-line text-brand-muted">{quotation.terms}</p>
            </Card>
          )}
        </aside>
      </div>
    </main>
  );
}
