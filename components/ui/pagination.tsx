import Link from "next/link";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

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
  pageParam = "page",
  compact = false,
}: {
  basePath: string;
  page: number;
  pageSize: number;
  total: number;
  params?: Record<string, string | undefined>;
  /** Nombre del parámetro de página en la URL (para tener dos paginaciones en una pantalla). */
  pageParam?: string;
  /** Versión corta (para listas dentro de una tarjeta). */
  compact?: boolean;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;

  const hrefFor = (p: number) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v && k !== pageParam) qs.set(k, v);
    }
    if (p > 1) qs.set(pageParam, String(p));
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
      {!compact && (
        <span>
          Mostrando {from}–{to} de {total}
        </span>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Primera / última página: sin tener que pasar página por página. */}
        <NavButton href={page > 1 ? hrefFor(1) : null} label="Primera página" className={linkClasses} disabledClassName={disabledClasses}>
          <ChevronsLeft size={14} />
        </NavButton>
        <NavButton href={page > 1 ? hrefFor(page - 1) : null} label="Página anterior" className={linkClasses} disabledClassName={disabledClasses}>
          <ChevronLeft size={14} /> {!compact && "Anterior"}
        </NavButton>
        {compact ? (
          <span className="px-1">
            {Math.min(page, totalPages)} / {totalPages}
          </span>
        ) : (
          pageWindow(page, totalPages).map((p, i) =>
            p === null ? (
              <span key={`gap-${i}`} className="px-1" aria-hidden>
                …
              </span>
            ) : p === page ? (
              <span
                key={p}
                aria-current="page"
                className="inline-flex min-w-[2.25rem] justify-center rounded-[var(--radius-md)] bg-brand-primary px-2.5 py-1.5 text-sm font-semibold text-white"
              >
                {p}
              </span>
            ) : (
              <Link key={p} href={hrefFor(p)} className={`${linkClasses} min-w-[2.25rem] justify-center px-2.5`} title={`Ir a la página ${p}`}>
                {p}
              </Link>
            ),
          )
        )}
        <NavButton href={page < totalPages ? hrefFor(page + 1) : null} label="Página siguiente" className={linkClasses} disabledClassName={disabledClasses}>
          {!compact && "Siguiente"} <ChevronRight size={14} />
        </NavButton>
        <NavButton
          href={page < totalPages ? hrefFor(totalPages) : null}
          label={`Última página (${totalPages})`}
          className={linkClasses}
          disabledClassName={disabledClasses}
        >
          <ChevronsRight size={14} />
        </NavButton>
      </div>
    </nav>
  );
}

/** Páginas a mostrar: 1 … 4 5 6 … 12 (la actual, sus vecinas, la primera y la última). */
export function pageWindow(page: number, totalPages: number): (number | null)[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const set = new Set([1, totalPages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= totalPages));
  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | null)[] = [];
  for (const p of sorted) {
    const last = out[out.length - 1];
    if (typeof last === "number" && p - last > 1) out.push(p - last === 2 ? last + 1 : null);
    out.push(p);
  }
  return out;
}

function NavButton({
  href,
  label,
  className,
  disabledClassName,
  children,
}: {
  href: string | null;
  label: string;
  className: string;
  disabledClassName: string;
  children: React.ReactNode;
}) {
  return href ? (
    <Link href={href} className={className} title={label} aria-label={label}>
      {children}
    </Link>
  ) : (
    <span className={disabledClassName} aria-disabled="true" title={label}>
      {children}
    </span>
  );
}
