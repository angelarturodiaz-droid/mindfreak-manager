"use client";

import { useActionState, useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Button } from "./button";
import { ResultDialog } from "./result-dialog";
import { toast } from "./toaster";
import type { MoneyActionState } from "@/lib/utils/bank-errors";

export type ConfirmableState = MoneyActionState;

/**
 * useActionState + ventanas emergentes para las operaciones con dinero
 * (reglas de cuentas, migración 063):
 * - Sobregiro por confirmar → ventana con Cancelar / Continuar; Continuar
 *   reenvía los mismos datos con confirm_overdraft=1 (la base de datos solo
 *   deja la cuenta en negativo si llega esa confirmación).
 * - Fondos o crédito insuficiente → ventana roja con el detalle y "Entendido".
 * - Éxito → ventana verde (o aviso corto si `successAs: "toast"`).
 *
 * Devuelve [state, formAction, pending, dialogs, formKey]: `dialogs` se pinta
 * dentro del formulario y `formKey` se usa como key del <form> para dejarlo
 * en blanco después de cada éxito.
 */
export function useOverdraftConfirmAction(
  action: (prevState: ConfirmableState, formData: FormData) => Promise<ConfirmableState>,
  initialState: ConfirmableState,
  options: { successAs?: "dialog" | "toast" } = {},
) {
  const successAs = options.successAs ?? "dialog";
  const lastFormData = useRef<FormData | null>(null);
  const [state, formAction, pending] = useActionState(async (prev: ConfirmableState, formData: FormData) => {
    lastFormData.current = formData;
    return action(prev, formData);
  }, initialState);
  const [dismissed, setDismissed] = useState<ConfirmableState | null>(null);
  const [, startTransition] = useTransition();
  const toasted = useRef<ConfirmableState | null>(null);

  const open = dismissed !== state;
  const showConfirm = Boolean(state.confirmOverdraft) && open;
  const showBlocked = Boolean(state.blocked) && open;
  const showSuccess = successAs === "dialog" && Boolean(state.success) && open;

  useEffect(() => {
    if (successAs === "toast" && state.success && toasted.current !== state) {
      toasted.current = state;
      toast.success(state.success);
    }
  }, [state, successAs]);

  const close = useCallback(() => setDismissed(state), [state]);

  function onContinue() {
    const previous = lastFormData.current;
    if (!previous) return;
    const next = new FormData();
    previous.forEach((value, key) => next.append(key, value));
    next.set("confirm_overdraft", "1");
    startTransition(() => formAction(next));
  }

  const dialogs = (
    <>
      <ResultDialog
        open={showConfirm}
        tone="warning"
        title="¿Continuar con sobregiro?"
        onClose={pending ? () => {} : close}
        actions={
          <>
            <Button type="button" variant="outline" onClick={close} disabled={pending} className="sm:min-w-28">
              Cancelar
            </Button>
            <Button type="button" onClick={onContinue} loading={pending} className="sm:min-w-28">
              Continuar
            </Button>
          </>
        }
      >
        <p>{state.confirmOverdraft}</p>
      </ResultDialog>

      <ResultDialog open={showBlocked} tone="danger" title={state.blockedTitle ?? "No se pudo registrar"} onClose={close}>
        <p className="text-brand-text">{state.blocked}</p>
        <p className="text-xs">No se registró nada. Puedes cambiar el monto o elegir otra cuenta.</p>
      </ResultDialog>

      <ResultDialog open={showSuccess} tone="success" title={state.successTitle ?? "Listo"} onClose={close}>
        <p className="text-brand-text">{state.success}</p>
      </ResultDialog>
    </>
  );

  return [state, formAction, pending, dialogs, state.successId ?? 0] as const;
}
