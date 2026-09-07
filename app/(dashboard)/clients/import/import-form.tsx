"use client";

import { useActionState } from "react";
import {
  importClientsCsvAction,
  type ImportActionState,
} from "@/features/clients/actions";

const initialState: ImportActionState = { error: null };

export function ImportForm() {
  const [state, formAction, pending] = useActionState(
    importClientsCsvAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex items-end gap-3">
      <div>
        <label className="block text-sm font-medium text-brand-text">
          Archivo CSV
        </label>
        <input
          type="file"
          name="file"
          accept=".csv,text/csv"
          required
          className="mt-1 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Importando…" : "Importar"}
      </button>

      {state.error && <p className="text-sm text-brand-danger">{state.error}</p>}
      {state.result && (
        <p className="text-sm text-brand-text">
          {state.result.success} de {state.result.total} filas importadas
          {state.result.errors > 0 &&
            ` (${state.result.errors} con errores)`}
          .
        </p>
      )}
    </form>
  );
}
