import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Paginación por query params (`?page=N`) para Server Components: los
 * enlaces conservan los demás filtros de la URL (estado, cliente, etc.).
 * No se muestra si todo cabe en una sola página.
 */
export function Pagination({
  basePath,
  page,
  pageSize,
  total,
  params = {},
}: {
  basePath: string;
  page: number;
  pageSize: number;
  total: number;
  params?: Record<string, string | undefined>;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;

  const hrefFor = (p: number) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v && k !== "page") qs.set(k, v);
    }
    if (p > 1) qs.set("page", String(p));
    const s = qs.toString();
    return s ? `${basePath}?${s}` : basePath;
  };

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const linkClasses =
    "inline-flex items-center gap-1 rounded-[var(--radius-md)] border border-brand-border bg-brand-surface px-3 py-1.5 text-sm font-medium text-brand-text transition-colors hover:bg-brand-surface-hover";
  const disabledClasses =
    "inline-flex items-center gap-1 rounded-[var(--radius-md)] border border-brand-border/60 px-3 py-1.5 text-sm font-medium text-brand-muted/60 cursor-not-allowed";

  return (
    <nav
      aria-label="Paginación"
      className="flex flex-wrap items-center justify-between gap-3 text-sm text-brand-muted"
    >
      <span>
        Mostrando {from}–{to} de {total}
      </span>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link href={hrefFor(page - 1)} className={linkClasses}>
            <ChevronLeft size={14} /> Anterior
          </Link>
        ) : (
          <span className={disabledClasses} aria-disabled="true">
            <ChevronLeft size={14} /> Anterior
          </span>
        )}
        <span className="px-1">
          Página {Math.min(page, totalPages)} de {totalPages}
        </span>
        {page < totalPages ? (
          <Link href={hrefFor(page + 1)} className={linkClasses}>
            Siguiente <ChevronRight size={14} />
          </Link>
        ) : (
          <span className={disabledClasses} aria-disabled="true">
            Siguiente <ChevronRight size={14} />
          </span>
        )}
      </div>
    </nav>
  );
}
