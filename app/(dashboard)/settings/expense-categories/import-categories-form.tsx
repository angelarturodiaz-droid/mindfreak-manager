"use client";

import { useActionState } from "react";
import { Download, Upload } from "lucide-react";
import {
  importExpenseCategoriesCsvAction,
  type ImportCategoriesState,
} from "@/features/expense-categories/actions";
import { Button } from "@/components/ui/button";

const initialState: ImportCategoriesState = { error: null };

export function ImportCategoriesForm() {
  const [state, formAction, pending] = useActionState(importExpenseCategoriesCsvAction, initialState);

  return (
    <div className="flex flex-col gap-3">
      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="categories-csv" className="block text-sm font-medium text-brand-text">
            Archivo CSV
          </label>
          <input
            id="categories-csv"
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
        <a
          href="/plantillas/categorias-gastos.csv"
          download
          className="inline-flex items-center gap-1.5 py-2 text-sm text-brand-accent hover:underline"
        >
          <Download size={14} /> Descargar plantilla
        </a>
      </form>
      <p className="text-xs text-brand-muted">
        Columnas: <span className="font-medium">nombre</span> (requerida) y{" "}
        <span className="font-medium">descripcion</span> (opcional). Las categorías que ya existen
        con el mismo nombre se omiten, no se duplican.
      </p>

      {state.error && <p className="text-sm text-brand-danger">{state.error}</p>}
      {state.result && (
        <div className="rounded-[var(--radius-md)] bg-brand-success-bg px-3 py-2 text-sm text-brand-text">
          <p>
            <span className="font-medium text-brand-success">{state.result.created} creadas</span>
            {" de "}
            {state.result.total} en el archivo
            {state.result.skipped > 0 && ` · ${state.result.skipped} omitidas porque ya existían`}.
          </p>
          {state.result.skippedNames.length > 0 && (
            <p className="mt-1 text-xs text-brand-muted">
              Omitidas: {state.result.skippedNames.slice(0, 10).join(", ")}
              {state.result.skippedNames.length > 10 && "…"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
