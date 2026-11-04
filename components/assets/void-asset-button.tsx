"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ResultDialog } from "@/components/ui/result-dialog";
import { toast } from "@/components/ui/toaster";
import { voidAssetAction } from "@/features/assets/actions";

/** «Anular (fue un error)»: pide el motivo, explica qué pasa y anula sin borrar nada. */
export function VoidAssetButton({ assetId, code, expenseDescription }: { assetId: string; code: string; expenseDescription: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const short = reason.trim().length < 10;

  function confirm() {
    startTransition(async () => {
      const r = await voidAssetAction(assetId, reason);
      if (r.error) {
        setError(r.error);
        return;
      }
      setOpen(false);
      setReason("");
      toast.success(r.success ?? "Activo anulado.");
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Si este activo se registró por error (nunca fue un activo), anúlalo: sale de la lista y se suelta del gasto. No se borra nada."
        className="inline-flex w-fit items-center gap-1.5 rounded-[var(--radius-md)] px-2.5 py-2 text-sm text-brand-muted hover:bg-brand-danger-bg hover:text-brand-danger"
      >
        <Ban size={14} aria-hidden /> Anular (fue un error)
      </button>
      <Modal open={open} onClose={() => !pending && setOpen(false)} title={`¿Anular ${code}?`} size="lg">
        <div className="flex flex-col gap-4 text-sm">
          <div className="rounded-[var(--radius-md)] border border-brand-accent/30 bg-brand-accent-light px-3 py-2.5 text-brand-text">
            <p className="font-medium">Úsalo solo si se registró por error (por ejemplo, era un servicio y no algo que la empresa tiene).</p>
            <p className="mt-1 text-brand-muted">
              Si sí lo tuvieron y ya no se usa (se dañó, se perdió, se regaló), no lo anules: edítalo y ponle <strong>Dado de baja</strong>.
            </p>
          </div>
          <div>
            <p className="font-medium text-brand-text">Qué va a pasar</p>
            <ul className="mt-1 flex list-disc flex-col gap-0.5 pl-5 text-brand-muted">
              <li>El activo pasa a <strong className="text-brand-danger">Anulado</strong> y ya no se puede editar.</li>
              <li>Sale de la lista y de las tarjetas (se ve con el filtro «Anulados»).</li>
              {expenseDescription ? (
                <li>
                  Se suelta del gasto <strong className="text-brand-text">{expenseDescription}</strong>. <strong className="text-brand-text">El gasto no cambia</strong> (mismo total, pagos y saldo).
                </li>
              ) : (
                <li>No está ligado a ningún gasto.</li>
              )}
              <li>No se borra nada: queda en su historial y en la Auditoría con quién, cuándo y el motivo. Su código no se vuelve a usar.</li>
            </ul>
          </div>
          <label className="flex flex-col gap-1">
            <span className="font-medium text-brand-text">
              Motivo <span className="text-brand-danger">*</span>
            </span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.currentTarget.value)}
              rows={2}
              placeholder="Ej. Lo registré por error: era el alquiler del sonido, no una bocina nuestra."
              className="w-full rounded-[var(--radius-md)] border border-brand-border bg-brand-surface px-3 py-2 text-sm text-brand-text outline-none focus:border-brand-accent focus:ring-2 focus:ring-brand-accent-light"
            />
            <span className={`text-xs ${short ? "text-brand-muted" : "text-brand-success"}`}>
              {short ? `Mínimo 10 letras (llevas ${reason.trim().length})` : "✓ Motivo listo"}
            </span>
          </label>
          <div className="flex justify-end gap-2 border-t border-brand-border pt-3">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button type="button" variant="danger" onClick={confirm} disabled={short} loading={pending}>
              Sí, anular
            </Button>
          </div>
        </div>
      </Modal>
      <ResultDialog open={error !== null} tone="danger" title="No se pudo anular" onClose={() => setError(null)}>
        <p className="text-brand-text">{error}</p>
      </ResultDialog>
    </>
  );
}
