"use client";

import { useTransition } from "react";
import type { ReactNode } from "react";
import { Button } from "./button";
import { toast } from "./toaster";

/**
 * Botón para invocar un Server Action simple (sin confirmación) desde un
 * componente cliente, mostrando un toast si falla en vez de tumbar la
 * página. Reemplaza el patrón `<form action={xxxAction.bind(null, id)}>`,
 * que al lanzar cualquier error (ej. una validación de negocio) rompe toda
 * la pantalla con el error genérico de Next.js — ver conversación con el
 * usuario (factura sin líneas al emitir).
 *
 * Uso:
 *   <ActionButton label="Emitir factura" onAction={() => issueInvoiceAction(invoice.id)} />
 *
 * Para acciones destructivas que necesitan confirmación, usar ConfirmButton
 * en su lugar (también protegido contra este mismo problema).
 */
export function ActionButton({
  label,
  onAction,
  variant = "outline",
  size = "sm",
  icon,
  className,
  successMessage,
}: {
  label: string;
  onAction: () => Promise<unknown> | unknown;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "icon";
  icon?: ReactNode;
  className?: string;
  /** Si se pasa, se muestra un toast de éxito al terminar sin error. */
  successMessage?: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      try {
        await onAction();
        if (successMessage) toast.success(successMessage);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ocurrió un error inesperado.");
      }
    });
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      icon={icon}
      loading={isPending}
      onClick={handleClick}
      className={className}
    >
      {label}
    </Button>
  );
}
