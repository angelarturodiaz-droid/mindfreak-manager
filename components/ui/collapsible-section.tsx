import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Bloque desplegable para reportes con varias tablas: el encabezado
 * (título, cantidad y un resumen como el total) siempre se ve; la tabla
 * se abre al pulsarlo. Así la página no se alarga. `open` = abierto al
 * cargar (ej. si el usuario está paginando esa tabla).
 */
export function CollapsibleSection({
  title,
  count,
  countLabel,
  summary,
  description,
  open = false,
  children,
}: {
  title: string;
  count?: number;
  /** Qué se cuenta (ej. «facturas»): sale junto al número para que se entienda. */
  countLabel?: string;
  /** A la derecha del título, ej. el total. */
  summary?: ReactNode;
  description?: ReactNode;
  open?: boolean;
  children: ReactNode;
}) {
  return (
    <details
      open={open}
      className="group rounded-[var(--radius-lg)] border border-brand-border bg-brand-surface [&_summary::-webkit-details-marker]:hidden"
    >
      <summary
        className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-brand-surface-hover"
        title="Pulsa para ver u ocultar"
      >
        <span className="flex min-w-0 flex-col">
          <span className="flex items-center gap-2 text-base font-semibold text-brand-text">
            <ChevronDown size={16} className="shrink-0 text-brand-muted transition-transform group-open:rotate-180" aria-hidden />
            {title}
            {count !== undefined && (
              <span
                className="rounded-full bg-brand-surface-hover px-2 py-0.5 text-xs font-medium tabular-nums text-brand-muted"
                title={countLabel ? `${count} ${countLabel}` : "Cantidad"}
              >
                {count}
                {countLabel ? ` ${countLabel}` : ""}
              </span>
            )}
          </span>
          {description && <span className="pl-6 text-sm text-brand-muted">{description}</span>}
        </span>
        <span className="flex items-center gap-3 text-sm">
          {summary}
          <span className="text-xs text-brand-accent group-open:hidden">Ver detalle</span>
          <span className="hidden text-xs text-brand-muted group-open:inline">Ocultar</span>
        </span>
      </summary>
      <div className="border-t border-brand-border p-3">{children}</div>
    </details>
  );
}
