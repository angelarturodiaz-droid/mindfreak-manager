import Link from "next/link";
import { FlowSteps } from "@/components/documents/flow-steps";
import { InvoiceFromQuotationButton } from "./invoice-from-quotation-button";
import { safeReturnTo, returnToLabel } from "@/lib/utils/return-to";
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
  Handshake,
  Receipt,
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
  negotiateQuotationAction,
  updateQuotationBankDetailsAction,
} from "@/features/quotations/actions";
import { listBankDetailOptions } from "@/features/banks/bank-details-server";
import { parseBankDetails } from "@/features/banks/bank-details";
import { BankDetailsPicker } from "@/components/documents/bank-details-picker";
import { NextStepBar, SideSection, TotalsStrip } from "@/components/documents/doc-layout";
import { hasPermission } from "@/lib/auth/permissions";
import { ChangeClientButton } from "@/components/documents/change-client-button";
import { listActiveClients, listDirectInvoicesFromQuotation } from "@/features/quotations/queries";
import { getDefaultTaxRate, listTaxRates } from "@/features/tax-rates/queries";
import { TAX_TREATMENT_LABELS } from "@/features/tax-rates/schema";
import { NewItemForm } from "./new-item-form";
import { ShareLinkButton } from "./share-link-button";
import { DuplicateQuotationButton } from "./duplicate-quotation-button";
import { DiscardQuotationButton } from "./discard-quotation-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { effectiveQuotationStatus } from "@/features/quotations/expired";
import { Card } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { ActionButton } from "@/components/ui/action-button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Chip, SectionHeader } from "@/components/ui/page-kit";
import { relationName, relationRow } from "@/lib/utils/relation";
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

/** Pasos de la cotización con su explicación (se ven en "Avance de la cotización"). */
const QUOTATION_FLOW = [
  {
    label: "Borrador",
    sub: "En preparación · editable",
    help: "La cotización se está preparando: agrega las líneas de servicio, precios, comisión y condiciones. Puedes cambiar el cliente. Cuando la compartas con el cliente (PDF o enlace), pulsa «Marcar como enviada».",
  },
  {
    label: "Enviada",
    sub: "Esperando al cliente",
    help: "El cliente ya la tiene. Si la abre con el enlace se marca «Vista». Si pide cambios, pásala a Negociación (se pueden editar las líneas) y vuelve a enviarla. Termina cuando el cliente la aprueba, la rechaza o vence su validez.",
  },
  {
    label: "Aprobada",
    sub: "El cliente aceptó",
    help: "El cliente aceptó la propuesta: las líneas quedan fijas. El siguiente paso es «Convertir en proyecto» para planificar el evento y facturar desde ahí (anticipo, balance…).",
  },
  {
    label: "Proyecto",
    sub: "Ya es parte de un proyecto",
    help: "Esta cotización ya está en un proyecto: o lo creó, o se sumó como cotización adicional (algo que el cliente pidió de más). Sus líneas están en la pestaña Servicios del proyecto y el trabajo sigue ahí: tareas, gastos y facturas.",
  },
] as const;

/** Detalle del paso 2 según el estado real. */
const SENT_DETAIL: Record<string, { label: string; sub: string }> = {
  SENT: { label: "Enviada", sub: "Esperando al cliente" },
  VIEWED: { label: "Enviada · vista", sub: "El cliente la abrió" },
  NEGOTIATING: { label: "En negociación", sub: "Ajustando con el cliente" },
};

export default async function QuotationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ return_to?: string }>;
}) {
  const { id } = await params;
  // Si se abrió desde un proyecto (o proveedor), "volver" regresa ahí.
  const returnTo = safeReturnTo((await searchParams).return_to);

  let quotation;
  try {
    quotation = await getQuotation(id);
  } catch {
    notFound();
  }
  if (!quotation) notFound();

  const [items, services, canUpdate, canApprove, defaultTaxRate, taxRates, bankDetailOptions, canCreateInvoice, canCreateProject, directInvoices] = await Promise.all([
    listQuotationItems(id),
    listActiveServices(),
    hasPermission("quotations.update"),
    hasPermission("quotations.approve"),
    getDefaultTaxRate(),
    listTaxRates(),
    // Cuentas que se pueden poner en "Datos bancarios para el pago" (opcional).
    listBankDetailOptions().catch(() => []),
    hasPermission("invoices.create"),
    hasPermission("projects.create"),
    // Venta sin evento: facturas hechas desde esta cotización sin proyecto.
    listDirectInvoicesFromQuotation(id),
  ]);
  // Para "Cambiar cliente" (solo en Borrador).
  const activeClients = quotation.status === "DRAFT" && canUpdate ? await listActiveClients() : [];

  const clientData = quotation.clients as { name: string } | { name: string }[] | null;
  const clientName = Array.isArray(clientData) ? clientData[0]?.name : clientData?.name;
  const linkedProject = relationRow<{ number: string; name: string }>((quotation as { project?: unknown }).project);

  const duplicatedFromData = quotation.duplicated_from as { number: string } | { number: string }[] | null;
  const duplicatedFromNumber = Array.isArray(duplicatedFromData)
    ? duplicatedFromData[0]?.number
    : duplicatedFromData?.number;

  const isEditable = quotation.status === "DRAFT" || quotation.status === "NEGOTIATING";
  // Expirada por la fecha de validez (ver features/quotations/expired.ts); se puede aprobar igual.
  const shownStatus = effectiveQuotationStatus(quotation);

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
          ? quotation.project_id || directInvoices.length
            ? 3
            : 2
          : -1;
  const closedLabel: Record<string, string> = {
    REJECTED: "Esta cotización fue rechazada por el cliente.",
    CANCELLED: "Esta cotización fue cancelada. Se conserva para auditoría.",
    EXPIRED: "Esta cotización expiró.",
  };
  const validity =
    quotation.valid_until && !["APPROVED", "REJECTED", "CANCELLED"].includes(quotation.status)
      ? daysFromToday(quotation.valid_until)
      : null;

  // Qué hacer ahora, según el estado (franja "Siguiente paso").
  const nextStep: { tone: "next" | "warning" | "done"; text: string } | null =
    ["CANCELLED", "REJECTED"].includes(quotation.status)
      ? null
      : quotation.status === "DRAFT"
        ? items.length === 0
          ? { tone: "next", text: "agrega las líneas de servicio (abajo, en Agregar línea)." }
          : { tone: "next", text: "comparte el PDF con el cliente y pulsa Marcar como enviada." }
        : quotation.status === "NEGOTIATING"
          ? { tone: "next", text: "ajusta las líneas y precios y pulsa Marcar como enviada de nuevo." }
          : quotation.status === "APPROVED"
            ? quotation.project_id
              ? { tone: "done", text: "ya es un proyecto. Sigue el trabajo desde Ver proyecto." }
              : directInvoices.length > 0
                ? {
                    tone: "done",
                    text: `ya se facturó sin proyecto (${directInvoices.map((d) => d.number).join(", ")}). El cobro se sigue desde la factura.`,
                  }
                : {
                    tone: "next",
                    text: "pulsa Convertir a Proyecto si es un evento, o Facturar sin proyecto si es una venta directa (ej. recarga de extintores).",
                  }
            : shownStatus === "EXPIRED"
              ? {
                  tone: "warning",
                  text: "la fecha de validez ya pasó. Si el cliente acepta igual, puedes Aprobarla; si no, Rechazar o Cancelar.",
                }
              : {
                  tone: "next",
                  text: "espera la respuesta del cliente: Aprobar, Rechazar o Pasar a negociación si pide cambios.",
                };
  const quotationBankDetails = parseBankDetails(quotation.bank_details);

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-8">
      <Link
        href={returnTo ?? "/quotations"}
        className="inline-flex w-fit items-center gap-1 text-sm text-brand-muted hover:text-brand-text"
      >
        <ArrowLeft size={14} /> {returnTo ? returnToLabel(returnTo) : "Cotizaciones"}
      </Link>

      <Card className="flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-brand-primary">
                {quotation.number}
              </h1>
              <Badge status={shownStatus}>
                {STATUS_LABELS[shownStatus] ?? shownStatus}
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
                {quotation.status === "DRAFT" && canUpdate && (
                  <dd className="ml-1">
                    <ChangeClientButton
                      kind="quotation"
                      documentId={quotation.id}
                      currentClientId={quotation.client_id}
                      clients={activeClients}
                      blockedReason={quotation.project_id ? "Esta cotización ya generó un proyecto; no se le puede cambiar el cliente." : null}
                    />
                  </dd>
                )}
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
              {/* Si ya generó un proyecto, se ve bien claro (como en la factura). */}
              {quotation.project_id && (
                <div className="flex items-center gap-1.5 rounded-full bg-brand-accent-light px-2.5 py-0.5">
                  <FolderKanban size={14} className="text-brand-accent" aria-hidden />
                  <dt className="text-xs font-medium text-brand-accent">Ya es parte del proyecto</dt>
                  <dd>
                    <Link href={`/projects/${quotation.project_id}`} className="text-xs font-semibold text-brand-accent hover:underline">
                      {linkedProject ? `${linkedProject.number} · ${linkedProject.name}` : "Ver proyecto"}
                    </Link>
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>

        {flowIndex >= 0 ? (
          <FlowSteps
            title="Avance de la cotización"
            hint="Una cotización pasa por estos pasos: se prepara en Borrador, se envía al cliente (y se negocia si pide cambios), el cliente la aprueba y se convierte en proyecto. El paso en azul es donde está ahora; los verdes ya se cumplieron. Si el cliente la rechaza, se cancela o vence, sale un aviso en lugar de los pasos."
            steps={QUOTATION_FLOW.map((step, i) => {
              // El último ("Proyecto") cuenta como completado al llegar.
              const done = i < flowIndex || (i === flowIndex && i === QUOTATION_FLOW.length - 1);
              const current = i === flowIndex && !done;
              // El paso 2 dice en qué punto está: enviada, vista por el cliente o en negociación.
              const sent = i === 1 && current ? SENT_DETAIL[quotation.status] : undefined;
              // Venta sin evento: el último paso es "Facturada" en vez de "Proyecto".
              const invoicedDirect = i === 3 && !quotation.project_id && directInvoices.length > 0;
              const lastNoProject = i === 3 && !quotation.project_id && directInvoices.length === 0;
              return {
                label: invoicedDirect ? "Facturada" : lastNoProject ? "Proyecto o factura" : sent?.label ?? step.label,
                sub: invoicedDirect
                  ? "Se facturó sin proyecto"
                  : lastNoProject
                    ? "Evento → proyecto · venta → factura"
                    : sent?.sub ?? step.sub,
                help: invoicedDirect
                  ? "Venta sin evento: se facturó directo desde esta cotización (sin proyecto). Las facturas están arriba, junto a los botones."
                  : lastNoProject
                    ? "Cuando el cliente aprueba: si es un evento, «Convertir a Proyecto» (para planificar y facturar desde el proyecto); si es una venta sin evento, «Facturar sin proyecto» crea la factura con estas líneas."
                    : step.help,
                state: done ? "done" : current ? "current" : "todo",
              };
            })}
          />
        ) : (
          <div className="rounded-[var(--radius-md)] bg-brand-danger-bg px-4 py-3 text-sm font-medium text-brand-danger">
            {closedLabel[quotation.status] ?? STATUS_LABELS[quotation.status]}
          </div>
        )}

        {nextStep && <NextStepBar tone={nextStep.tone}>{nextStep.text}</NextStepBar>}

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
            {(quotation.status === "SENT" || quotation.status === "VIEWED") && canUpdate && (
              <ActionButton
                label="Pasar a negociación"
                icon={<Handshake size={14} />}
                onAction={negotiateQuotationAction.bind(null, quotation.id)}
              />
            )}
            {quotation.status === "NEGOTIATING" && canUpdate && (
              <ActionButton
                label="Marcar como enviada de nuevo"
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
            {/* Evento → proyecto. Si ya se facturó sin proyecto, no se convierte (quedaría fuera del proyecto). */}
            {quotation.status === "APPROVED" && !quotation.project_id && canCreateProject && directInvoices.length === 0 && (
              <Link href={`/projects/from-quotation/${quotation.id}`}>
                <Button variant="secondary" size="sm" className="!bg-brand-success" icon={<ArrowRightCircle size={14} />}>
                  Convertir a Proyecto
                </Button>
              </Link>
            )}
            {/* Venta sin evento: factura directa con las líneas de la cotización. */}
            {quotation.status === "APPROVED" && !quotation.project_id && canCreateInvoice && (
              <InvoiceFromQuotationButton quotationId={quotation.id} existing={directInvoices} />
            )}
            {directInvoices.map((inv) => (
              <Link
                key={inv.id}
                href={`/invoices/${inv.id}`}
                className="inline-flex items-center gap-1.5 rounded-full bg-brand-accent-light px-2.5 py-1 text-xs font-medium text-brand-accent hover:underline"
                title="Factura hecha desde esta cotización (sin proyecto)"
              >
                <Receipt size={12} aria-hidden /> {inv.number} · {formatMoney(inv.total, inv.currency)}
              </Link>
            ))}
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

      <TotalsStrip
        items={[
          { label: "Subtotal", value: formatMoney(quotation.subtotal, quotation.currency) },
          ...(quotation.commission_percent > 0
            ? [
                {
                  label: `Comisión (${quotation.commission_percent}%)`,
                  value: formatMoney(quotation.commission_amount, quotation.currency),
                  note:
                    TAX_TREATMENT_LABELS[quotation.commission_tax_treatment as keyof typeof TAX_TREATMENT_LABELS] ??
                    quotation.commission_tax_treatment,
                },
              ]
            : []),
          {
            label: "Descuento",
            value: quotation.discount > 0 ? `−${formatMoney(quotation.discount, quotation.currency)}` : "—",
            tone: quotation.discount > 0 ? ("default" as const) : ("muted" as const),
          },
          { label: "Impuesto", value: formatMoney(quotation.tax, quotation.currency) },
          { label: "Total", value: formatMoney(quotation.total, quotation.currency), tone: "strong" as const },
          {
            label: "Costo estimado",
            value: formatMoney(quotation.estimated_cost, quotation.currency),
            info: "Suma de los costos unitarios estimados de las líneas. Es interno: no sale en el PDF ni lo ve el cliente.",
            tone: "muted" as const,
          },
          {
            label: "Margen estimado",
            value: `${quotation.estimated_margin?.toFixed(1) ?? "0.0"} %`,
            info: "Margen sobre el total según los costos estimados. Interno: no lo ve el cliente.",
            tone: "muted" as const,
          },
        ]}
      />

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
              <NewItemForm quotationId={quotation.id} services={services} defaultTaxRate={defaultTaxRate} taxRates={taxRates} currency={quotation.currency} />
            </Card>
          )}
        </section>

        <aside className="flex flex-col gap-4">
          {quotation.payment_terms_id && (
            <SideSection title="Condición de pago" summary={pt ?? undefined}>
              <p className="text-sm text-brand-text">{pt ?? "—"}</p>
              <p className="mt-1 text-sm text-brand-muted">
                {quotation.credit_days} días de crédito · {quotation.advance_percent}% anticipo /{" "}
                {quotation.balance_percent}% saldo
              </p>
            </SideSection>
          )}

          {quotation.terms && (
            <SideSection title="Condiciones" summary="Texto que sale en el PDF">
              <p className="whitespace-pre-line text-sm text-brand-muted">{quotation.terms}</p>
            </SideSection>
          )}

          <SideSection
            title="Datos bancarios para el pago"
            info="Opcional en cotizaciones: las cuentas que marques salen abajo en el PDF (ej. para el anticipo). Se ofrecen las cuentas marcadas en Bancos como «Mostrar en facturas y cotizaciones»; nunca tarjetas."
            summary={
              quotationBankDetails.length
                ? `En el PDF: ${quotationBankDetails.map((d) => d.account_name).join(", ")}`
                : "Opcional · no sale en el PDF"
            }
            defaultOpen={quotationBankDetails.length > 0}
          >
            <BankDetailsPicker
              docLabel="cotización"
              currency={quotation.currency}
              options={bankDetailOptions}
              current={quotationBankDetails}
              editable={canUpdate && quotation.status !== "CANCELLED" && quotation.status !== "REJECTED"}
              lockedReason={
                canUpdate && (quotation.status === "CANCELLED" || quotation.status === "REJECTED")
                  ? "La cotización está cancelada o rechazada."
                  : undefined
              }
              onSave={updateQuotationBankDetailsAction.bind(null, quotation.id)}
            />
          </SideSection>
        </aside>
      </div>
    </main>
  );
}
