import type { ReactNode } from "react";

export interface Column<T> {
  header: string;
  accessor: (row: T) => ReactNode;
  className?: string;
}

/**
 * Tabla con estilo consistente para toda la app: encabezados, hover por
 * fila, espaciado uniforme. No incluye orden/paginación por sí sola —
 * eso se agrega por pantalla cuando aplica (cada lista ya trae su propio
 * filtro por query params, que es más liviano para Server Components).
 */
export function DataTable<T>({
  columns,
  rows,
  keyFor,
  emptyMessage = "Sin resultados.",
  maxWidth = "max-w-4xl",
}: {
  columns: Column<T>[];
  rows: T[];
  keyFor: (row: T) => string;
  emptyMessage?: string;
  maxWidth?: string;
}) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-brand-muted">{emptyMessage}</p>;
  }

  return (
    <div className={`overflow-x-auto rounded-[var(--radius-lg)] border border-brand-border ${maxWidth}`}>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-brand-border bg-brand-background text-left text-xs font-medium uppercase tracking-wide text-brand-muted">
            {columns.map((col, i) => (
              <th key={i} className={`px-4 py-3 ${col.className ?? ""}`}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={keyFor(row)}
              className="border-b border-brand-border/60 bg-brand-surface transition-colors last:border-0 hover:bg-brand-surface-hover"
            >
              {columns.map((col, i) => (
                <td key={i} className={`px-4 py-3 ${col.className ?? ""}`}>
                  {col.accessor(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
