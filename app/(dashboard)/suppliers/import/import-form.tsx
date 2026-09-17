"use client";

import { useActionState } from "react";
import { Upload } from "lucide-react";
import {
  importSuppliersCsvAction,
  type ImportActionState,
} from "@/features/suppliers/actions";
import { Button } from "@/components/ui/button";

const initialState: ImportActionState = { error: null };

export function ImportForm() {
  const [state, formAction, pending] = useActionState(
    importSuppliersCsvAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div>
        <label className="block text-sm font-medium text-brand-text">
          Archivo CSV
        </label>
        <input
          type="file"
          name="file"
          accept=".csv,text/csv"
          required
          className="mt-1 text-sm text-brand-muted file:mr-3 file:rounded-[var(--radius-md)] file:border-0 file:bg-brand-primary file:px-3 file:py-1.5 file:text-sm file:text-white"
        />
      </div>
      <Button type="submit" loading={pending} icon={<Upload size={14} />}>
        Importar
      </Button>

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
