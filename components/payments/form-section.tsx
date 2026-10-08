import type { ReactNode } from "react";

/**
 * Bloque con título pequeño para ordenar los formularios de pago y cobro
 * en filas parejas (en vez de campos sueltos uno al lado del otro).
 * `cols` = columnas en pantallas medianas o más grandes; en el celular, una.
 */
export function FormSection({
  step,
  title,
  cols = 3,
  children,
}: {
  step?: number;
  title: string;
  cols?: 2 | 3;
  children: ReactNode;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brand-muted">
        {step !== undefined && (
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-accent-light text-[11px] text-brand-accent">
            {step}
          </span>
        )}
        {title}
      </legend>
      <div className={`grid grid-cols-1 items-start gap-x-4 gap-y-3 ${cols === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        {children}
      </div>
    </fieldset>
  );
}

/** Pie del formulario: error a la izquierda, Cancelar y el botón principal a la derecha. */
export function FormFooter({ error, children }: { error?: string | null; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-t border-brand-border pt-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-brand-danger">{error}</p>
      <div className="flex justify-end gap-2">{children}</div>
    </div>
  );
}
