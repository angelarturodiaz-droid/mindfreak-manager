"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { FileCheck2, FilePlus2, Ban, Paperclip } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { toast } from "@/components/ui/toaster";
import { formatMoney } from "@/lib/utils/money";
import { formatDate, formatDateTime } from "@/lib/utils/dates";
import { updateWithholdingSupportAction, voidWithholdingAction, type ActionState } from "@/features/payments/actions";
import { getDocumentDownloadUrlAction } from "@/features/documents/actions";
import { CERT_INFO, WITHHOLDING_TYPE_LABELS, type WithholdingType } from "@/features/payments/withholdings";

export type WithholdingItem = {
  id: string;
  withholding_type: string;
  amount: number;
  currency: string;
  certificate_amount: number | null;
  certificate_currency: string | null;
  certificate_number: string | null;
  withholding_date: string;
  notes: string | null;
  status: string;
  voided_at: string | null;
  void_reason: string | null;
  documents: { id: string; file_name: string; storage_path: string } | { id: string; file_name: string; storage_path: string }[] | null;
};

function docOf(w: WithholdingItem) {
  return Array.isArray(w.documents) ? w.documents[0] ?? null : w.documents;
}

/**
 * Retenciones de un cobro en la tabla de cobros de la factura: chip por
 * retención, "Sin certificado" con Agregar certificado, y Anular (permiso
 * payments.void). Una anulada queda tachada con el motivo.
 */
export function WithholdingList({
  items,
  invoiceId,
  functionalCurrency,
  canEdit,
  canVoid,
}: {
  items: WithholdingItem[];
  invoiceId: string;
  functionalCurrency: string;
  canEdit: boolean;
  canVoid: boolean;
}) {
  const [certFor, setCertFor] = useState<WithholdingItem | null>(null);
  const [voidFor, setVoidFor] = useState<WithholdingItem | null>(null);
  if (items.length === 0) return <span className="text-brand-muted">—</span>;

  return (
    <div className="flex flex-col items-start gap-1.5 text-xs">
      {items.map((w) => {
        const voided = w.status === "VOIDED";
        const doc = docOf(w);
        const label = WITHHOLDING_TYPE_LABELS[w.withholding_type as WithholdingType] ?? w.withholding_type;
        const noCert = !voided && !w.certificate_number && !doc;
        return (
          <div key={w.id} className="flex flex-col gap-0.5">
            <span className={`flex flex-wrap items-center gap-1.5 ${voided ? "text-brand-muted line-through" : "text-brand-text"}`}>
              <span className="rounded-full bg-brand-accent-light px-2 py-0.5 font-medium text-brand-accent">{label}</span>
              <span className="font-medium tabular-nums">{formatMoney(w.amount, w.currency)}</span>
              {w.certificate_amount && w.certificate_currency && w.certificate_currency !== w.currency && (
                <span className="text-brand-muted">(cert. {formatMoney(w.certificate_amount, w.certificate_currency)})</span>
              )}
              {w.certificate_number && <span className="text-brand-muted">· n.º {w.certificate_number}</span>}
            </span>
            {voided ? (
              // La hora puede formatearse distinto en el servidor y el navegador.
              <span className="text-brand-danger" suppressHydrationWarning>
                Anulada{w.voided_at ? ` el ${formatDateTime(w.voided_at)}` : ""}
                {w.void_reason ? ` — ${w.void_reason}` : ""}
              </span>
            ) : (
              <span className="flex flex-wrap items-center gap-2">
                {noCert && (
                  <span className="rounded-full bg-brand-warning-bg px-2 py-0.5 font-medium text-brand-warning">Sin certificado</span>
                )}
                {doc && <OpenDocLink path={doc.storage_path} />}
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => setCertFor(w)}
                    className="inline-flex items-center gap-1 text-brand-accent hover:underline"
                  >
                    {noCert ? <FilePlus2 size={12} /> : <FileCheck2 size={12} />}
                    {noCert ? "Agregar certificado" : "Editar certificado"}
                  </button>
                )}
                {canVoid && (
                  <button
                    type="button"
                    onClick={() => setVoidFor(w)}
                    className="inline-flex items-center gap-1 text-brand-danger hover:underline"
                  >
                    <Ban size={12} /> Anular
                  </button>
                )}
              </span>
            )}
          </div>
        );
      })}
      {certFor && (
        <CertificateModal
          item={certFor}
          invoiceId={invoiceId}
          functionalCurrency={functionalCurrency}
          onClose={() => setCertFor(null)}
        />
      )}
      {voidFor && <VoidModal item={voidFor} invoiceId={invoiceId} onClose={() => setVoidFor(null)} />}
    </div>
  );
}

function OpenDocLink({ path }: { path: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await getDocumentDownloadUrlAction(path);
          if (res.url) window.open(res.url, "_blank", "noopener");
          else toast.error(res.error ?? "No se pudo abrir el archivo.");
        })
      }
      className="inline-flex items-center gap-1 text-brand-accent hover:underline"
    >
      <Paperclip size={12} /> Ver certificado
    </button>
  );
}

function CertificateModal({
  item,
  invoiceId,
  functionalCurrency,
  onClose,
}: {
  item: WithholdingItem;
  invoiceId: string;
  functionalCurrency: string;
  onClose: () => void;
}) {
  const action = updateWithholdingSupportAction.bind(null, item.id, invoiceId);
  const [state, formAction, pending] = useActionState(action, { error: null } as ActionState);
  const foreign = item.currency !== functionalCurrency;
  useEffect(() => {
    if (state.success) {
      toast.success(state.success);
      onClose();
    }
  }, [state, onClose]);

  return (
    <Modal open onClose={() => !pending && onClose()} title="Certificado de retención">
      <form action={formAction} className="space-y-3">
        <p className="text-sm text-brand-muted">
          {WITHHOLDING_TYPE_LABELS[item.withholding_type as WithholdingType] ?? item.withholding_type}{" "}
          {formatMoney(item.amount, item.currency)} del {formatDate(item.withholding_date)}. Los montos no cambian.
        </p>
        <Input
          label="N.º de certificado"
          info={CERT_INFO}
          name="certificate_number"
          defaultValue={item.certificate_number ?? ""}
          placeholder="Ej. CR-2026-00123"
        />
        {foreign && (
          <MoneyInput
            label={`Monto del certificado (${functionalCurrency})`}
            name="certificate_amount"
            defaultValue={item.certificate_amount ?? ""}
            hint="Lo que dice el certificado en pesos. Informativo para el contador."
          />
        )}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-brand-text" htmlFor={`cert-file-${item.id}`}>
            Archivo del certificado (PDF o foto)
          </label>
          <input
            id={`cert-file-${item.id}`}
            type="file"
            name="file"
            accept="application/pdf,image/*"
            className="text-sm text-brand-text file:mr-3 file:rounded-[var(--radius-md)] file:border file:border-brand-border file:bg-brand-surface file:px-3 file:py-1.5 file:text-sm"
          />
          <p className="text-xs text-brand-muted">Opcional. Queda guardado en los documentos de la factura. Máximo 15MB.</p>
        </div>
        <Input label="Nota" name="notes" defaultValue={item.notes ?? ""} placeholder="Opcional" />
        {state.error && <p className="text-sm text-brand-danger">{state.error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            Cerrar
          </Button>
          <Button type="submit" loading={pending}>
            Guardar certificado
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function VoidModal({ item, invoiceId, onClose }: { item: WithholdingItem; invoiceId: string; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const label = WITHHOLDING_TYPE_LABELS[item.withholding_type as WithholdingType] ?? item.withholding_type;
  return (
    <Modal open onClose={() => !pending && onClose()} title="¿Anular esta retención?">
      <div className="space-y-3 text-sm">
        <p className="text-brand-text">
          Retención {label} de <strong>{formatMoney(item.amount, item.currency)}</strong>. Al anularla, la factura vuelve
          a tener <strong>{formatMoney(item.amount, item.currency)}</strong> más de saldo por cobrar. El banco no cambia
          (la retención nunca entró al banco). No se borra: queda tachada con el motivo, y en Auditoría.
        </p>
        <Input
          label="Motivo"
          name="void_reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Ej. el monto del certificado era otro"
          hint="Mínimo 10 letras."
        />
        {error && <p className="text-brand-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            No, volver
          </Button>
          <Button
            type="button"
            variant="danger"
            loading={pending}
            disabled={reason.trim().length < 10}
            onClick={() =>
              start(async () => {
                const res = await voidWithholdingAction(item.id, invoiceId, reason);
                if (res.error) setError(res.error);
                else {
                  toast.success("Retención anulada. La factura volvió a tener ese saldo.");
                  onClose();
                }
              })
            }
          >
            Sí, anular retención
          </Button>
        </div>
      </div>
    </Modal>
  );
}
