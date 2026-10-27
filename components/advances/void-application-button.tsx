"use client";

import { useState, useTransition } from "react";
import { Undo2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { ResultDialog } from "@/components/ui/result-dialog";
import { voidAdvanceApplicationAction } from "@/features/advances/actions";
import { formatMoney } from "@/lib/utils/money";

/**
 * «Quitar» una aplicación de anticipo hecha por error: la factura vuelve a
 * deber ese monto y el anticipo vuelve a quedar disponible. Pide el motivo.
 */
export function VoidApplicationButton({
  movementId,
  amount,
  currency,
  advanceNumber,
  invoiceNumber,
}: {
  movementId: string;
  amount: number;
  currency: string;
  advanceNumber: string;
  invoiceNumber: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      try {
        await voidAdvanceApplicationAction(movementId, reason);
        setOpen(false);
        setReason("");
        setResult({
          ok: true,
          text: `Se quitó el anticipo ${advanceNumber} de la factura ${invoiceNumber}. La factura vuelve a deber ${formatMoney(amount, currency)} y el anticipo queda disponible otra vez.`,
        });
      } catch (err) {
        setResult({ ok: false, text: err instanceof Error ? err.message : "No se pudo quitar." });
      }
    });
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        icon={<Undo2 size={13} />}
        onClick={() => setOpen(true)}
        hint="Si se aplicó por error: la factura vuelve a deber ese monto y el anticipo queda disponible."
      >
        Quitar
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={`¿Quitar el anticipo ${advanceNumber} de ${invoiceNumber}?`}>
        <p className="mb-3 text-sm text-brand-muted">
          La factura volverá a deber {formatMoney(amount, currency)} y el anticipo quedará disponible para aplicarlo bien.
          No se mueve el banco. Queda anotado en la Auditoría.
        </p>
        <Textarea
          label="Motivo"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          placeholder="Ej. Se aplicó a la factura equivocada"
        />
        <div className="mt-4 flex justify-end gap-3">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button variant="danger" loading={pending} disabled={reason.trim().length < 3} onClick={confirm}>
            Sí, quitar
          </Button>
        </div>
      </Modal>
      <ResultDialog
        open={result !== null}
        tone={result?.ok ? "success" : "danger"}
        title={result?.ok ? "Anticipo quitado" : "No se pudo quitar"}
        onClose={() => setResult(null)}
      >
        <p className="text-brand-text">{result?.text}</p>
      </ResultDialog>
    </>
  );
}
