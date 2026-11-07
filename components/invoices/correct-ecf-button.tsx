"use client";

import { useActionState, useEffect, useState, useTransition, type FormEvent } from "react";
import { PencilLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { ResultDialog } from "@/components/ui/result-dialog";
import { useSuccessToast } from "@/components/ui/use-success-toast";
import { correctEcfDataAction, type EcfFileState } from "@/features/invoices/ecf-files";

/** Hora local de RD («2026-11-06T09:30») para un campo datetime-local. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  return new Date(new Date(iso).getTime() - 4 * 60 * 60 * 1000).toISOString().slice(0, 16);
}

type Current = { e_ncf: string | null; security_code: string | null; digital_signature_at: string | null; e_ncf_valid_until: string | null };

/**
 * 6-nov: «Corregir datos del e-CF» (error de tipeo). Solo Administración; los demás lo ven en gris y al pulsarlo
 * les sale el mensaje de a quién pedírselo.
 */
export function CorrectEcfButton({ invoiceId, current, canCorrect }: { invoiceId: string; current: Current; canCorrect: boolean }) {
  const [open, setOpen] = useState(false);
  const [denied, setDenied] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => (canCorrect ? setOpen(true) : setDenied(true))}
        title={canCorrect ? "Corrige el e-NCF, el código o la fecha si se escribieron mal (con motivo)." : "Solo Administración puede corregir los datos del e-CF."}
        className={`inline-flex w-fit items-center gap-1 text-xs ${canCorrect ? "text-brand-accent hover:underline" : "cursor-not-allowed text-brand-muted/60"}`}
      >
        <PencilLine size={12} aria-hidden /> Corregir datos del e-CF
      </button>
      <ResultDialog open={denied} tone="warning" title="Solo Administración" onClose={() => setDenied(false)}>
        <p className="text-brand-text">
          Los datos del e-CF solo los puede corregir <strong>Administración</strong>. Si ves un error (por ejemplo, un número mal
          escrito), avísale y dile cuál es el dato correcto.
        </p>
      </ResultDialog>
      <Modal open={open} onClose={() => setOpen(false)} title="Corregir datos del e-CF">
        {open && <CorrectForm invoiceId={invoiceId} current={current} onDone={() => setOpen(false)} />}
      </Modal>
    </>
  );
}

function CorrectForm({ invoiceId, current, onDone }: { invoiceId: string; current: Current; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(correctEcfDataAction.bind(null, invoiceId), { error: null } as EcfFileState);
  const [, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const [closed, setClosed] = useState<EcfFileState | null>(null);
  useSuccessToast(state);
  useEffect(() => {
    if (state.successId) onDone();
  }, [state.successId, onDone]);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => formAction(fd));
  }
  const left = Math.max(0, 10 - reason.trim().length);

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <p className="rounded-[var(--radius-md)] bg-brand-info-bg px-3 py-2 text-sm text-brand-text">
        Úsalo solo si <strong>el e-CF de la DGII está bien</strong> y aquí se escribió mal (ej. un número cambiado). Si el error
        es de la factura en la DGII (montos, cliente, líneas), se corrige allá con una <strong>nota de crédito</strong>.
      </p>
      <Input label="e-NCF" name="e_ncf" defaultValue={current.e_ncf ?? ""} required info="E + tipo (31, 32…) + 10 números. Si ya adjuntaste el XML, tiene que ser el mismo." />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input label="Código de seguridad" name="security_code" defaultValue={current.security_code ?? ""} />
        <Input label="Fecha y hora de firma" name="digital_signature_at" type="datetime-local" defaultValue={toLocalInput(current.digital_signature_at)} />
      </div>
      <Input label="Válido hasta (opcional)" name="e_ncf_valid_until" type="date" defaultValue={current.e_ncf_valid_until ?? ""} />
      <Textarea
        label="Motivo"
        name="reason"
        rows={2}
        required
        value={reason}
        onChange={(e) => setReason(e.currentTarget.value)}
        placeholder="Ej. Se escribió E31…371 en vez de E31…317"
      />
      <p className={`-mt-2 text-xs ${left ? "text-brand-muted" : "text-brand-success"}`}>{left ? `Mínimo 10 letras (llevas ${reason.trim().length}).` : "✓ Motivo listo"}</p>
      <p className="text-xs text-brand-muted">Queda en la Auditoría con lo que había antes, lo nuevo, quién y por qué.</p>
      <div className="flex justify-end gap-2 border-t border-brand-border pt-3">
        <Button type="button" variant="outline" onClick={onDone} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" loading={pending} disabled={left > 0}>
          Guardar corrección
        </Button>
      </div>
      <ResultDialog open={Boolean(state.error) && closed !== state} tone="danger" title="No se pudo corregir" onClose={() => setClosed(state)}>
        <p className="text-brand-text">{state.error}</p>
      </ResultDialog>
    </form>
  );
}
