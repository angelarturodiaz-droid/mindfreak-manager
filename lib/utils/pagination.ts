/** Filas por página en todas las listas (10: la página no baja tanto). */
export const PAGE_SIZE = 10;

/** Convierte el query param `?page=` en un número de página válido (1 si falta o es inválido). */
export function parsePage(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/** Rango inclusivo [from, to] para `.range()` de Supabase. */
export function pageRange(page: number, pageSize = PAGE_SIZE): [number, number] {
  const from = (page - 1) * pageSize;
  return [from, from + pageSize - 1];
}

/** Las filas de una página de una lista ya cargada en memoria. */
export function paginate<T>(rows: T[], page: number, pageSize = PAGE_SIZE): T[] {
  return rows.slice((page - 1) * pageSize, page * pageSize);
}
