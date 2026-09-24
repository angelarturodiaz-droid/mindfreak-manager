/**
 * Nombre de una relación embebida de Supabase (ej. `clients(name)`).
 *
 * Para una relación muchos-a-uno (factura → cliente) PostgREST devuelve un
 * objeto `{ name }` o `null`, pero los tipos que infiere supabase-js a veces
 * la tipan como arreglo. Leerla como `rel?.[0]?.name` daba siempre
 * `undefined` y la columna mostraba "—". Esta función acepta ambas formas.
 */
export function relationName(rel: unknown): string | null {
  const row = Array.isArray(rel) ? rel[0] : rel;
  const name = (row as { name?: unknown } | null | undefined)?.name;
  return typeof name === "string" ? name : null;
}

/** Fila de una relación embebida muchos-a-uno (objeto o arreglo según el tipado), o null. */
export function relationRow<T>(rel: unknown): T | null {
  const row = Array.isArray(rel) ? rel[0] : rel;
  return (row as T | null | undefined) ?? null;
}
