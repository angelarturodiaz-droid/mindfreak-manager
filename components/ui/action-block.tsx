"use client";

import { useTransition } from "react";
import type { ReactNode } from "react";
import { toast } from "./toaster";

/**
 * Bloque clicable (ej. un paso de un flujo) que invoca un Server Action.
 * Igual que ActionButton/ActionLink: si la acción falla muestra un toast
 * en vez de tumbar la página, y queda deshabilitado mientras corre.
 * El aspecto lo define quien lo usa (className + children).
 */
export function ActionBlock({
  onAction,
  className = "",
  title,
  children,
}: {
  onAction: () => Promise<unknown> | unknown;
  className?: string;
  title?: string;
  children: ReactNode;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      title={title}
      disabled={isPending}
      aria-busy={isPending}
      onClick={() =>
        startTransition(async () => {
          try {
            await onAction();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Ocurrió un error inesperado.");
          }
        })
      }
      className={`${className} disabled:cursor-wait disabled:opacity-60`}
    >
      {children}
    </button>
  );
}
