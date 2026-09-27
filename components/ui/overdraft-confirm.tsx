"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "./button";

export type ConfirmableState = { error: string | null; confirmOverdraft?: string };

/**
 * useActionState + confirmación de sobregiro (reglas de cuentas, migración
 * 063). Si el servidor responde `confirmOverdraft`, se muestra el aviso con
 * Cancelar / Continuar; Continuar reenvía los mismos datos con
 * confirm_overdraft=1 (la base de datos solo deja la cuenta en negativo si
 * llega esa confirmación). Devuelve además `confirmBox` para pintarlo dentro
 * del formulario.
 */
export function useOverdraftConfirmAction(
  action: (prevState: ConfirmableState, formData: FormData) => Promise<ConfirmableState>,
  initialState: ConfirmableState,
) {
  const lastFormData = useRef<FormData | null>(null);
  const [state, formAction, pending] = useActionState(async (prev: ConfirmableState, formData: FormData) => {
    lastFormData.current = formData;
    return action(prev, formData);
  }, initialState);
  const [dismissed, setDismissed] = useState<ConfirmableState | null>(null);
  const [, startTransition] = useTransition();

  const showConfirm = Boolean(state.confirmOverdraft) && dismissed !== state;

  function onContinue() {
    const previous = lastFormData.current;
    if (!previous) return;
    const next = new FormData();
    previous.forEach((value, key) => next.append(key, value));
    next.set("confirm_overdraft", "1");
    startTransition(() => formAction(next));
  }

  const confirmBox = showConfirm ? (
    <div
      role="alertdialog"
      aria-live="assertive"
      className="flex w-full flex-col gap-3 rounded-[var(--radius-md)] border border-brand-warning/40 bg-brand-warning-bg px-4 py-3"
    >
      <p className="flex items-start gap-2 text-sm text-brand-text">
        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-brand-warning" aria-hidden />
        <span>{state.confirmOverdraft}</span>
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setDismissed(state)} disabled={pending}>
          Cancelar
        </Button>
        <Button type="button" size="sm" onClick={onContinue} loading={pending}>
          Continuar
        </Button>
      </div>
    </div>
  ) : null;

  return [state, formAction, pending, confirmBox] as const;
}
