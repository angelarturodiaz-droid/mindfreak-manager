import Link from "next/link";
import { SearchX } from "lucide-react";

/**
 * Aviso cuando un filtro no encontró nada. Se usa en todos los listados y
 * reportes con filtros, para que quede claro que la lista está vacía por el
 * filtro (no porque no existan registros) y cómo quitarlo.
 */
export function NoResults({
  what = "registros",
  clearHref,
  hint,
}: {
  /** Qué se buscaba, en plural: "facturas", "movimientos"… */
  what?: string;
  /** Enlace para quitar los filtros. */
  clearHref?: string;
  hint?: string;
}) {
  return (
    <div
      role="status"
      className="flex flex-col items-center gap-3 rounded-[var(--radius-lg)] border border-brand-warning/40 bg-brand-warning-bg px-6 py-8 text-center"
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-surface text-brand-warning">
        <SearchX size={22} aria-hidden />
      </div>
      <div>
        <p className="text-sm font-semibold text-brand-text">No se encontraron {what} con los filtros aplicados.</p>
        <p className="mt-1 text-sm text-brand-muted">
          {hint ?? "Revisa los filtros (fechas, estado, cliente…) o quítalos para ver todo."}
        </p>
      </div>
      {clearHref && (
        <Link
          href={clearHref}
          className="rounded-[var(--radius-md)] border border-brand-border bg-brand-surface px-3 py-1.5 text-sm font-medium text-brand-accent hover:border-brand-accent"
        >
          Limpiar filtros
        </Link>
      )}
    </div>
  );
}
