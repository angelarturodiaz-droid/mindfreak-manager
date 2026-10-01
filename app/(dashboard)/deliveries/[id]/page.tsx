import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Check,
  Copy,
  FileSignature,
  FolderKanban,
  Hash,
  Package,
  Pencil,
  Send,
  Undo2,
} from "lucide-react";
import { getDelivery, listDeliveryItems } from "@/features/deliveries/queries";
import {
  backToDraftDeliveryAction,
  cancelDeliveryAction,
  discardDeliveryAction,
  duplicateDeliveryAction,
  issueDeliveryAction,
} from "@/features/deliveries/actions";
import {
  DEFAULT_DELIVERY_PLACE,
  DELIVERY_FLOW,
  DELIVERY_FLOW_LABELS,
  DELIVERY_STATUS_LABELS,
  DELIVERY_STATUS_TONE,
  DELIVERY_TYPE_LABELS,
  DELIVERY_TYPE_TEXT,
  defaultFooterNote,
  formatTotal,
  totalQuantity,
} from "@/features/deliveries/schema";
import { listDocuments } from "@/features/documents/queries";
import { hasPermission } from "@/lib/auth/permissions";
import { DocumentList } from "@/components/documents/document-list";
import { PrintDeliveryButton } from "@/components/deliveries/print-delivery-button";
import { UploadSignedForm } from "@/components/deliveries/upload-signed-form";
import { ActionButton } from "@/components/ui/action-button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/page-kit";
import { relationRow } from "@/lib/utils/relation";
import { formatDate, formatDateTime } from "@/lib/utils/dates";
import { returnToLabel, safeReturnTo, withReturnTo } from "@/lib/utils/return-to";

export default async function DeliveryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ return_to?: string }>;
}) {
  const { id } = await params;
  const returnTo = safeReturnTo((await searchParams).return_to);

  let receipt;
  try {
    receipt = await getDelivery(id);
  } catch {
    notFound();
  }
  if (!receipt) notFound();

  const [items, signedDocs, canCreate, canCancel, canViewDocs] = await Promise.all([
    listDeliveryItems(id),
    listDocuments("delivery_receipt", id).catch(() => []),
    hasPermission("deliveries.create"),
    hasPermission("deliveries.cancel"),
    hasPermission("documents.view"),
  ]);

  const client = relationRow<{ id: string; name: string; tax_id: string | null }>(receipt.clients);
  const project = relationRow<{ id: string; number: string; name: string }>(receipt.projects);
  const createdBy = relationRow<{ full_name: string | null }>(receipt.created_by_profile)?.full_name;
  const signedBy = relationRow<{ full_name: string | null }>(receipt.signed_by_profile)?.full_name;
  const typeText = DELIVERY_TYPE_TEXT[receipt.delivery_type] ?? DELIVERY_TYPE_TEXT.OTHER;
  const total = totalQuantity(items);
  const status: string = receipt.status;
  const editable = canCreate && (status === "DRAFT" || status === "ISSUED");
  const flowIndex = DELIVERY_FLOW.indexOf(status as (typeof DELIVERY_FLOW)[number]);
  const detailPath = `/deliveries/${id}`;

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-8">
      <Link
        href={returnTo ?? "/deliveries"}
        className="inline-flex w-fit items-center gap-1 text-sm text-brand-muted hover:text-brand-text"
      >
        <ArrowLeft size={14} /> {returnTo ? returnToLabel(returnTo) : "Entregas y acuses"}
      </Link>

      <Card className="flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-brand-primary">{receipt.number}</h1>
              <Badge tone={DELIVERY_STATUS_TONE[status]}>{DELIVERY_STATUS_LABELS[status] ?? status}</Badge>
              <Badge tone="neutral">
                <Package size={12} className="shrink-0" aria-hidden />
                {DELIVERY_TYPE_LABELS[receipt.delivery_type] ?? receipt.delivery_type}
              </Badge>
              {receipt.duplicated_from_id && (
                <Badge tone="neutral">
                  <Copy size={12} className="shrink-0" aria-hidden />
                  <Link href={`/deliveries/${receipt.duplicated_from_id}`} className="underline hover:text-brand-accent">
                    Duplicado
                  </Link>
                </Badge>
              )}
            </div>
            <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <div className="flex items-center gap-1.5">
                <Building2 size={15} className="text-brand-muted" aria-hidden />
                <dt className="sr-only">Cliente</dt>
                <dd>
                  {client ? (
                    <Link href={`/clients/${client.id}?tab=entregas`} className="font-medium text-brand-text hover:text-brand-accent">
                      {client.name}
                    </Link>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              {project && (
                <div className="flex items-center gap-1.5">
                  <FolderKanban size={15} className="text-brand-muted" aria-hidden />
                  <dt className="sr-only">Proyecto</dt>
                  <dd>
                    <Link href={`/projects/${project.id}`} className="text-brand-text hover:text-brand-accent">
                      {project.number} · {project.name}
                    </Link>
                  </dd>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <CalendarDays size={15} className="text-brand-muted" aria-hidden />
                <dt className="sr-only">Fecha</dt>
                <dd className="text-brand-text">Entrega {formatDate(receipt.delivery_date)}</dd>
              </div>
              {receipt.reference && (
                <div className="flex min-w-0 items-center gap-1.5">
                  <Hash size={15} className="shrink-0 text-brand-muted" aria-hidden />
                  <dt className="sr-only">Referencia</dt>
                  <dd className="truncate text-brand-text">{receipt.reference}</dd>
                </div>
              )}
            </dl>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-xs font-medium uppercase tracking-wide text-brand-muted">{typeText.totalLabel}</p>
            <p className="text-2xl font-semibold tabular-nums text-brand-primary">{formatTotal(total)}</p>
          </div>
        </div>

        {flowIndex >= 0 ? (
          <ol className="grid grid-cols-1 gap-2 border-t border-brand-border pt-5 sm:grid-cols-3" aria-label="Avance del acuse">
            {DELIVERY_FLOW.map((step, i) => {
              // Pasos completados en verde; "Firmado" es el último: al llegar ya está completo.
              const isSigned = status === "SIGNED";
              const done = i < flowIndex || (isSigned && i === flowIndex);
              const current = i === flowIndex && !isSigned;
              return (
                <li
                  key={step}
                  aria-current={current ? "step" : undefined}
                  className={`flex items-center gap-2.5 rounded-[var(--radius-md)] border px-3 py-2.5 ${
                    done
                      ? "border-brand-success/40 bg-brand-success-bg"
                      : current
                        ? "border-brand-accent/40 bg-brand-accent-light"
                        : "border-brand-border bg-brand-surface"
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                      done ? "bg-brand-success text-white" : current ? "bg-brand-accent text-white" : "border border-brand-border text-brand-muted"
                    }`}
                  >
                    {done ? <Check size={14} /> : i + 1}
                  </span>
                  <span className={`text-sm ${current || done ? "font-medium text-brand-text" : "text-brand-muted"}`}>
                    {DELIVERY_FLOW_LABELS[step]}
                  </span>
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="rounded-[var(--radius-md)] bg-brand-danger-bg px-4 py-3 text-sm font-medium text-brand-danger">
            Este acuse fue anulado{receipt.cancelled_at ? ` el ${formatDateTime(receipt.cancelled_at)}` : ""}. Se conserva para el
            historial; el PDF sale con la marca «ANULADO».
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-brand-border pt-4">
          <div className="flex flex-wrap gap-2">
            <PrintDeliveryButton
              receiptId={id}
              number={receipt.number}
              variant={status === "DRAFT" || status === "ISSUED" ? "primary" : "outline"}
            />
            {canCreate && status === "DRAFT" && (
              <ActionButton
                label="Marcar como pendiente de firma"
                icon={<Send size={14} />}
                successMessage="Acuse marcado como pendiente de firma."
                onAction={issueDeliveryAction.bind(null, id)}
              />
            )}
            {canCreate && status === "ISSUED" && (
              <ActionButton
                label="Volver a borrador"
                variant="ghost"
                icon={<Undo2 size={14} />}
                successMessage="El acuse volvió a borrador."
                onAction={backToDraftDeliveryAction.bind(null, id)}
              />
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {editable && (
              <Link href={withReturnTo(`/deliveries/${id}/edit`, returnTo)}>
                <Button variant="outline" size="sm" icon={<Pencil size={14} />}>
                  Editar
                </Button>
              </Link>
            )}
            {canCreate && (
              <ConfirmButton
                label="Duplicar"
                variant="secondary"
                icon={<Copy size={14} />}
                confirmTitle={`¿Duplicar ${receipt.number}?`}
                confirmMessage="Se crea un acuse nuevo en borrador, con la fecha de hoy y las mismas líneas."
                confirmLabel="Duplicar"
                successMessage="Acuse duplicado."
                onConfirm={duplicateDeliveryAction.bind(null, id)}
              />
            )}
            {canCancel && status !== "CANCELLED" && (
              <ConfirmButton
                label="Anular"
                confirmTitle={`¿Anular ${receipt.number}?`}
                confirmMessage="Se conserva en el historial del cliente como anulado. No se puede deshacer."
                successMessage="Acuse anulado."
                onConfirm={cancelDeliveryAction.bind(null, id)}
              />
            )}
            {canCreate && status === "DRAFT" && (
              <ConfirmButton
                label="Descartar borrador"
                confirmTitle={`¿Descartar ${receipt.number}?`}
                confirmMessage="El borrador se borra por completo."
                successMessage="Borrador descartado."
                onConfirm={discardDeliveryAction.bind(null, id)}
              />
            )}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
          <section className="flex flex-col gap-3">
            <SectionHeader title={`${typeText.noun.charAt(0).toUpperCase()}${typeText.noun.slice(1)} entregados`} count={items.length} />
            <Card padded={false} className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-brand-primary text-left text-xs uppercase tracking-wide text-white">
                  <tr>
                    <th className="w-14 px-4 py-2.5 font-medium">No.</th>
                    <th className="px-4 py-2.5 font-medium">{typeText.itemHeader}</th>
                    <th className="w-20 px-4 py-2.5 text-right font-medium">Cant.</th>
                    <th className="px-4 py-2.5 font-medium">{typeText.referenceHeader}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={it.id} className="border-t border-brand-border even:bg-brand-accent-light/40">
                      <td className="px-4 py-2.5 font-semibold tabular-nums text-brand-accent">{String(i + 1).padStart(2, "0")}</td>
                      <td className="px-4 py-2.5 text-brand-text">{it.description}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{Number.isInteger(it.quantity) ? it.quantity : it.quantity.toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-brand-muted">{it.reference ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-brand-border bg-brand-surface-hover">
                    <td colSpan={2} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-brand-accent">
                      {typeText.totalLabel}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{formatTotal(total)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </Card>
          </section>

          <section className="flex flex-col gap-3">
            <SectionHeader title="Textos del acuse" description="Así sale en el PDF (vacío = texto del modelo)." />
            <Card className="flex flex-col gap-3 text-sm">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-brand-muted">Subtítulo</p>
                <p className="text-brand-text">{receipt.subtitle || typeText.subtitle}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-brand-muted">Párrafo de entrada</p>
                <p className="text-brand-text">{receipt.intro_text || <span className="text-brand-muted">Texto automático del modelo.</span>}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-brand-muted">Nota del pie</p>
                <p className="text-brand-text">
                  {defaultFooterNote(receipt.delivery_type, receipt.copies)}
                  {receipt.notes ? ` ${receipt.notes}` : ""}
                </p>
              </div>
            </Card>
          </section>
        </div>

        <aside className="flex flex-col gap-4">
          <Card className="flex flex-col gap-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-brand-text">
              <FileSignature size={16} className="text-brand-accent" /> Acuse firmado
            </p>
            {status === "SIGNED" ? (
              <div className="rounded-[var(--radius-md)] border border-brand-success/40 bg-brand-success-bg px-3 py-2.5 text-sm text-brand-text">
                <p className="font-medium text-brand-success">Firmado y adjunto</p>
                {receipt.received_by_name && (
                  <p>
                    Recibido por <strong>{receipt.received_by_name}</strong>
                    {receipt.received_by_position ? `, ${receipt.received_by_position}` : ""}
                  </p>
                )}
                {receipt.received_at && <p>El {formatDateTime(receipt.received_at)}</p>}
                <p className="text-xs text-brand-muted">
                  Adjuntado {formatDateTime(receipt.signed_at)}
                  {signedBy ? ` por ${signedBy}` : ""}
                </p>
              </div>
            ) : status !== "CANCELLED" ? (
              <p className="text-sm text-brand-muted">
                1) Imprime el acuse, 2) llévalo a firmar y sellar, 3) súbelo aquí escaneado o en foto. Al subirlo queda como{" "}
                <strong>Firmado</strong>.
              </p>
            ) : null}
            {canViewDocs && signedDocs.length > 0 && (
              <DocumentList documents={signedDocs} canDelete={false} revalidatePathValue={detailPath} />
            )}
            {canCreate && status !== "CANCELLED" && (
              <div className="border-t border-brand-border pt-3">
                <UploadSignedForm receiptId={id} alreadySigned={status === "SIGNED"} />
              </div>
            )}
          </Card>

          <Card className="text-sm">
            <p className="mb-3 font-semibold text-brand-text">Datos del acuse</p>
            <dl className="flex flex-col gap-2">
              <div>
                <dt className="text-xs text-brand-muted">Destinatario</dt>
                <dd className="text-brand-text">
                  {receipt.recipient_name}
                  {receipt.recipient_short_name ? ` (${receipt.recipient_short_name})` : ""}
                </dd>
              </div>
              {receipt.recipient_department && (
                <div>
                  <dt className="text-xs text-brand-muted">Departamento</dt>
                  <dd className="text-brand-text">{receipt.recipient_department}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-brand-muted">Lugar y fecha</dt>
                <dd className="text-brand-text">
                  {receipt.place || DEFAULT_DELIVERY_PLACE} · {formatDate(receipt.delivery_date)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-brand-muted">Ejemplares</dt>
                <dd className="text-brand-text">{receipt.copies}</dd>
              </div>
              {(receipt.delivered_by_name || receipt.delivered_by_id_number) && (
                <div>
                  <dt className="text-xs text-brand-muted">Entregado por</dt>
                  <dd className="text-brand-text">
                    {receipt.delivered_by_name}
                    {receipt.delivered_by_id_number ? ` · Cédula ${receipt.delivered_by_id_number}` : ""}
                  </dd>
                </div>
              )}
              <div className="border-t border-brand-border pt-2 text-xs text-brand-muted">
                Creado {formatDateTime(receipt.created_at)}
                {createdBy ? ` por ${createdBy}` : ""}
                {receipt.issued_at ? ` · Pendiente de firma desde ${formatDateTime(receipt.issued_at)}` : ""}
              </div>
            </dl>
          </Card>
        </aside>
      </div>
    </main>
  );
}
