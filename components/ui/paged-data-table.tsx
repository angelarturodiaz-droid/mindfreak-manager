import type { ComponentProps } from "react";
import { DataTable } from "./data-table";
import { Pagination } from "./pagination";
import { PAGE_SIZE, paginate, parsePage } from "@/lib/utils/pagination";

/**
 * Tabla con los datos ya cargados y paginación por query param (10 por
 * página, igual que las listas). Para reportes: así la página no baja tanto.
 * Con varias tablas en una pantalla, cada una usa su propio `pageParam`.
 */
export function PagedDataTable<T>({
  basePath,
  params,
  pageParam = "page",
  pageSize = PAGE_SIZE,
  rows,
  ...table
}: ComponentProps<typeof DataTable<T>> & {
  basePath: string;
  /** Query params actuales (filtros), para no perderlos al cambiar de página. */
  params: Record<string, string | undefined>;
  pageParam?: string;
  pageSize?: number;
}) {
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.min(parsePage(params[pageParam]), totalPages);
  return (
    <div className="flex flex-col gap-3">
      <DataTable {...table} rows={paginate(rows, page, pageSize)} />
      <Pagination
        basePath={basePath}
        page={page}
        pageSize={pageSize}
        total={rows.length}
        params={params}
        pageParam={pageParam}
      />
    </div>
  );
}
