import type { ReactNode } from "react";
import { NoResults } from "./no-results";

export function EmptyState({
  icon,
  title,
  description,
  action,
  filtered = false,
  clearHref,
  what,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  /** Hay filtros activos: se muestra el aviso "No se encontraron…" en lugar del estado vacío. */
  filtered?: boolean;
  clearHref?: string;
  what?: string;
}) {
  if (filtered) return <NoResults what={what} clearHref={clearHref} />;
  return (
    <div className="flex flex-col items-center gap-3 rounded-[var(--radius-lg)] border border-dashed border-brand-border bg-brand-surface px-6 py-12 text-center">
      {icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-accent-light text-brand-accent">
          {icon}
        </div>
      )}
      <div>
        <p className="text-sm font-medium text-brand-text">{title}</p>
        {description && <p className="mt-1 text-sm text-brand-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
