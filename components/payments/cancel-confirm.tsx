"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ResultDialog } from "@/components/ui/result-dialog";

/**
 * Botón "Cancelar" de Registrar pago / Registrar cobro: pregunta antes de
 * descartar lo escrito y, si se confirma, limpia el formulario y vuelve a
 * la lista (Facturas o Gastos). "Seguir aquí" cierra la pregunta sin tocar
 * nada.
 */
export function CancelConfirm({
  what,
  backHref,
  backLabel,
  onDiscard,
  disabled,
}: {
  /** "cobro" o "pago". */
  what: string;
  backHref: string;
  /** Ej. "Facturas". */
  backLabel: string;
  onDiscard: () => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const btn =
    "inline-flex items-center justify-center rounded-[var(--radius-md)] px-5 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-1 sm:min-w-36";
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        onClick={() => setOpen(true)}
        disabled={disabled}
        hint={`Descarta este ${what} sin guardar nada y vuelve a ${backLabel}.`}
      >
        Cancelar
      </Button>
      <ResultDialog
        open={open}
        tone="warning"
        title={`¿Cancelar este ${what}?`}
        onClose={() => setOpen(false)}
        actions={
          <>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className={`${btn} border border-brand-border text-brand-text hover:bg-brand-surface-hover`}
            >
              Seguir aquí
            </button>
            <button
              type="button"
              data-autofocus
              onClick={() => {
                setOpen(false);
                onDiscard();
                router.push(backHref);
              }}
              className={`${btn} bg-brand-primary text-white hover:bg-brand-primary-hover`}
            >
              Sí, volver a {backLabel}
            </button>
          </>
        }
      >
        <p className="text-brand-text">Lo que escribiste no se guarda. No se registra ningún {what}.</p>
      </ResultDialog>
    </>
  );
}
