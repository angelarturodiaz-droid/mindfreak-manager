"use client";

import { useEffect, useRef } from "react";
import { toast } from "./toaster";

/**
 * Muestra el aviso verde "…guardado/creado" cuando una acción de formulario
 * devuelve `success` (con `successId` distinto en cada éxito).
 */
export function useSuccessToast(state: { success?: string; successId?: number }) {
  const shown = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (state.success && state.successId && shown.current !== state.successId) {
      shown.current = state.successId;
      toast.success(state.success);
    }
  }, [state.success, state.successId]);
}
