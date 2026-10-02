"use client";

import { useTransition } from "react";
import { toast } from "./toaster";
import { Tooltip } from "./tooltip";
import { BUTTON_HINTS } from "@/lib/ui/button-hints";
import { isNavigationSignal } from "@/lib/utils/navigation-signal";

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
        // redirect() del servidor: la acción salió bien, no es un error.
        if (isNavigationSignal(err)) return;
        toast.error(err instanceof Error ? err.message : "Ocurrió un error inesperado.");
      }
    });
  }

  const button = (
    <button type="button" onClick={handleClick} disabled={isPending} className={className}>
      {isPending ? (pendingLabel ?? "...") : label}
    </button>
  );
  const hint = BUTTON_HINTS[label.trim()];
  return (
    hint ? <Tooltip text={hint}>{button}</Tooltip> : button
  );
}
