import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Texto de búsqueda seguro para los filtros `or(...)` de Supabase: sin
 * comas, paréntesis, comillas ni comodines (romperían el filtro), máximo
 * 80 caracteres. Vacío = sin búsqueda.
 */
export function cleanSearch(q?: string | null): string | undefined {
  const s = (q ?? "").replace(/[%,()*"\\:]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  return s || undefined;
}

/** Ids de clientes o proveedores cuyo nombre contiene el texto (para buscar documentos por su nombre). */
export async function idsByName(
  supabase: SupabaseClient,
  table: "clients" | "suppliers",
  q: string,
): Promise<string[]> {
  const { data } = await supabase.from(table).select("id").ilike("name", `%${q}%`).limit(200);
  return (data ?? []).map((r: { id: string }) => r.id);
}

/**
 * Condición `or` de PostgREST: alguna de las columnas contiene el texto, o
 * el id relacionado está en la lista (ej. facturas de los clientes que se
 * llaman así).
 */
export function searchOr(q: string, columns: string[], related?: { column: string; ids: string[] }): string {
  // Entre comillas: así puntos o espacios del texto (ej. "S.R.L.") no rompen el filtro.
  const parts = columns.map((c) => `${c}.ilike."%${q}%"`);
  if (related && related.ids.length) parts.push(`${related.column}.in.(${related.ids.join(",")})`);
  return parts.join(",");
}
