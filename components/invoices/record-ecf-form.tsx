"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { ResultDialog } from "@/components/ui/result-dialog";
import { useSuccessToast } from "@/components/ui/use-success-toast";
import { recordEcfDataAction, type ActionState } from "@/features/invoices/actions";

/** Factura ya emitida: anotar (una sola vez) el e-NCF y los datos que devuelve el Facturador. */
export function RecordEcfForm({
  invoiceId,
  current,
}: {
  invoiceId: string;
  current: { e_ncf: string | null; security_code: string | null; digital_signature_at: string | null; e_ncf_valid_until: string | null };
}) {
  const [state, formAction, pending] = useActionState(recordEcfDataAction.bind(null, invoiceId), { error: null } as ActionState);
  // Cada respuesta es un objeto nuevo: la ventana de error se muestra hasta que se cierra esa respuesta.
  const [closed, setClosed] = useState<ActionState | null>(null);
  useSuccessToast(state);
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <p className="text-xs text-brand-muted">
        Anota lo que te dio el Facturador. <strong>Solo se puede anotar una vez</strong>: revísalo antes de guardar.
      </p>
      {!current.e_ncf && <Input label="e-NCF" name="e_ncf" placeholder="Ej. E310000000371" info="E + tipo (31, 32…) + 10 dígitos." />}
      {!current.security_code && <Input label="Código de seguridad" name="security_code" placeholder="Ej. A1B2C3" />}
      {!current.digital_signature_at && <Input label="Fecha y hora de firma" name="digital_signature_at" type="datetime-local" />}
      {!current.e_ncf_valid_until && <Input label="e-NCF válido hasta (opcional)" name="e_ncf_valid_until" type="date" />}
      <Button type="submit" size="sm" loading={pending} className="w-fit">
        Anotar datos del e-CF
      </Button>
      <ResultDialog open={Boolean(state.error) && closed !== state} tone="danger" title="Revisa los datos del e-CF" onClose={() => setClosed(state)}>
        <p className="text-brand-text">{state.error}</p>
      </ResultDialog>
    </form>
  );
}
