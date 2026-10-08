"use client";

import { useState } from "react";
import { ResultDialog } from "./result-dialog";
import type { MoneyActionState } from "@/lib/utils/bank-errors";

/**
 * Ventana roja para formularios que no usan useOverdraftConfirmAction:
 * se abre cuando la acción devuelve `blocked` (ej. "Falta un dato" porque
 * la tasa de cambio está vacía) y se cierra con "Cerrar" o Escape.
 */
export function MissingDataDialog({ state }: { state: Partial<MoneyActionState> }) {
  const [dismissed, setDismissed] = useState<unknown>(null);
  const open = Boolean(state.blocked) && dismissed !== state;
  return (
    <ResultDialog
      open={open}
      tone="danger"
      title={state.blockedTitle ?? "No se pudo guardar"}
      onClose={() => setDismissed(state)}
    >
      <p className="text-brand-text">{state.blocked}</p>
    </ResultDialog>
  );
}
