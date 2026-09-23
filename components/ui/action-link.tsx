"use client";

import { useTransition } from "react";
import { toast } from "./toaster";

/**
 * Como ActionButton, pero renderizado como texto/link simple (para tablas
 * y listas donde no cabe un botón con borde). Mismo manejo de errores:
 * un toast en vez de tumbar la página. Ver components/ui/action-button.tsx.
 */
export function ActionLink({
  label,
  onAction,
  className = "text-sm text-brand-accent hover:underline",
  pendingLabel,
}: {
  label: string;
  onAction: () => Promise<unknown> | unknown;
  className?: string;
  pendingLabel?: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      try {
        await onAction();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ocurrió un error inesperado.");
      }
    });
  }

  return (
    <button type="button" onClick={handleClick} disabled={isPending} className={className}>
      {isPending ? (pendingLabel ?? "...") : label}
    </button>
  );
}
