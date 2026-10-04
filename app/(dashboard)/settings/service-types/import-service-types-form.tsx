"use client";

import { useActionState } from "react";
import { Download, Upload } from "lucide-react";
import {
  importServiceTypesCsvAction,
  type ImportServiceTypesState,
} from "@/features/supplier-service-types/actions";
import { Button } from "@/components/ui/button";

const initialState: ImportServiceTypesState = { error: null };

export function ImportServiceTypesForm() {
  const [state, formAction, pending] = useActionState(importServiceTypesCsvAction, initialState);

  return (
    <div className="flex flex-col gap-3">
      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="service-types-csv" className="block text-sm font-medium text-brand-text">
            Archivo CSV
          </label>
          <input
            id="service-types-csv"
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
          href="/plantillas/tipos-servicio.csv"
          download
          className="inline-flex items-center gap-1.5 py-2 text-sm text-brand-accent hover:underline"
        >
          <Download size={14} /> Descargar plantilla
        </a>
      </form>
      <p className="text-xs text-brand-muted">
        Columnas: <span className="font-medium">categoria</span>,{" "}
        <span className="font-medium">tipo_servicio</span> y (opcionales){" "}
        <span className="font-medium">descripcion_categoria</span> y{" "}
        <span className="font-medium">clasificacion_fiscal</span> (nombre, ej. &quot;Servicio técnico&quot;; también
        clasifica los tipos que ya existen). Si la categoría no existe se crea
        en Categorías (una fila con tipo vacío crea solo la categoría). Lo que ya existe se omite: no
        se repiten nombres aunque cambien mayúsculas, acentos o espacios, y un tipo de servicio solo
        puede estar en una categoría.
      </p>

      {state.error && <p className="text-sm text-brand-danger">{state.error}</p>}
      {state.result && (
        <div className="rounded-[var(--radius-md)] bg-brand-success-bg px-3 py-2 text-sm text-brand-text">
          <p>
            <span className="font-medium text-brand-success">{state.result.created} creados</span>
            {" de "}
            {state.result.total} en el archivo
            {state.result.skipped > 0 && ` · ${state.result.skipped} omitidos porque ya existían`}.
          </p>
          {(state.result.classified ?? 0) > 0 && (
            <p className="mt-1 text-xs text-brand-muted">
              Con clasificación fiscal: {state.result.classified}
            </p>
          )}
          {(state.result.unknownClassifications?.length ?? 0) > 0 && (
            <p className="mt-1 text-xs text-brand-warning">
              Clasificaciones no reconocidas (se dejaron sin clasificar):{" "}
              {state.result.unknownClassifications?.join(", ")}
            </p>
          )}
          {state.result.categoriesCreated.length > 0 && (
            <p className="mt-1 text-xs text-brand-muted">
              Categorías nuevas: {state.result.categoriesCreated.join(", ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
