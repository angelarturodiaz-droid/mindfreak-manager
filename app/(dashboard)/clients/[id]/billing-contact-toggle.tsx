"use client";

import { useState, useTransition } from "react";
import { BellRing } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import { ResultDialog } from "@/components/ui/result-dialog";
import { toggleContactBillingAction } from "@/features/clients/actions";

/**
 * Casilla «Recibe recordatorios de cobro» en la tarjeta del contacto
 * (ej. el contable). Los recordatorios de facturas van a los contactos
 * marcados; si no hay ninguno, al correo del cliente.
 */
export function BillingContactToggle({
  contactId,
  clientId,
  checked,
  hasEmail,
  disabled,
}: {
  contactId: string;
  clientId: string;
  checked: boolean;
  hasEmail: boolean;
  disabled?: boolean;
}) {
  const [value, setValue] = useState(checked);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle(next: boolean) {
    setValue(next);
    startTransition(async () => {
      const r = await toggleContactBillingAction(contactId, clientId, next);
      if (r.error) {
        setValue(!next);
        setError(r.error);
      }
    });
  }

  return (
    <>
      <Tooltip
        text={
          hasEmail
            ? "Marcado: los recordatorios de las facturas de este cliente (correo y WhatsApp) le llegan a este contacto, por ejemplo al contable. Puedes marcar varios. Si no marcas ninguno, van al correo del cliente."
            : "Este contacto no tiene correo: con la casilla marcada solo se usa su teléfono para el WhatsApp. Agrégale un correo para que reciba los recordatorios por correo."
        }
      >
        <label
          className={`inline-flex w-fit cursor-pointer items-center gap-2 rounded-full border px-2.5 py-1 text-xs ${
            value ? "border-brand-accent/40 bg-brand-accent-light text-brand-accent" : "border-brand-border text-brand-muted"
          } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
        >
          <input
            type="checkbox"
            checked={value}
            disabled={disabled || pending}
            onChange={(e) => toggle(e.target.checked)}
            className="h-3.5 w-3.5 accent-[var(--brand-accent)]"
          />
          <BellRing size={12} aria-hidden />
          Recibe recordatorios de cobro
        </label>
      </Tooltip>
      <ResultDialog open={Boolean(error)} tone="danger" title="No se guardó" onClose={() => setError(null)}>
        {error}
      </ResultDialog>
    </>
  );
}
