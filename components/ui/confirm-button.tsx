"use client";

import { useState, useTransition } from "react";
import { Modal } from "./modal";
import { Button } from "./button";

/**
 * Botón para acciones destructivas: muestra un modal de confirmación propio
 * en vez del window.confirm() nativo del navegador. Uso:
 *
 *   <ConfirmButton
 *     label="Eliminar"
 *     confirmTitle="¿Eliminar esta tarea?"
 *     confirmMessage="No se puede deshacer."
 *     onConfirm={() => deleteTaskAction(id)}
 *   />
 */
export function ConfirmButton({
  label,
  confirmTitle,
  confirmMessage,
  confirmLabel = "Confirmar",
  variant = "danger",
  size = "sm",
  icon,
  onConfirm,
}: {
  label: string;
  confirmTitle: string;
  confirmMessage?: string;
  confirmLabel?: string;
  variant?: "danger" | "primary" | "secondary";
  size?: "sm" | "md";
  icon?: React.ReactNode;
  onConfirm: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      await onConfirm();
      setOpen(false);
    });
  }

  return (
    <>
      <Button variant="ghost" size={size} icon={icon} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={confirmTitle}>
        {confirmMessage && (
          <p className="mb-4 text-sm text-brand-muted">{confirmMessage}</p>
        )}
        <div className="flex justify-end gap-3">
          <Button variant="outline" size="md" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button variant={variant} size="md" loading={isPending} onClick={handleConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </Modal>
    </>
  );
}
