import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Texto de búsqueda seguro para los filtros de Supabase: solo letras
 * (con o sin tilde), números, espacios y - / & #; máximo 80 caracteres.
 * Vacío = sin búsqueda.
 */
export function cleanSearch(q?: string | null): string | undefined {
  const s = (q ?? "")
    .replace(/[^\p{L}\p{N}\s\-/&#]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return s || undefined;
}

/** Minúsculas y sin tildes ("Producción" → "produccion"). */
export function stripAccents(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

const ACCENT_CLASS: Record<string, string> = {
  a: "[aáàäâ]",
  e: "[eéèëê]",
  i: "[iíìïî]",
  o: "[oóòöô]",
  u: "[uúùüû]",
  n: "[nñ]",
  c: "[cç]",
};

/**
 * Patrón (expresión regular de Postgres, sin distinguir mayúsculas) que
 * encuentra el texto con o sin tildes: "produccion", "producción" y
 * "PRODUCCION" encuentran "Producción". Se usa con el operador `imatch`.
 */
export function accentPattern(q: string): string {
  return stripAccents(q)
    .split("")
    .map((ch) => ACCENT_CLASS[ch] ?? (/[\p{L}\p{N}\s]/u.test(ch) ? ch : `\\${ch}`))
    .join("");
}

/** Ids de clientes o proveedores cuyo nombre contiene el texto, con o sin tildes. */
export async function idsByName(
  supabase: SupabaseClient,
  table: "clients" | "suppliers",
  q: string,
): Promise<string[]> {
  const { data } = await supabase.from(table).select("id").filter("name", "imatch", accentPattern(q)).limit(200);
  return (data ?? []).map((r: { id: string }) => r.id);
}

/**
 * Condición `or` de PostgREST: alguna de las columnas contiene el texto
 * (con o sin tildes, sin importar mayúsculas), o el id relacionado está en
 * la lista (ej. facturas de los clientes que se llaman así).
 */
export function searchOr(q: string, columns: string[], related?: { column: string; ids: string[] }): string {
  // Entre comillas: así espacios o barras del texto no rompen el filtro.
  const pattern = accentPattern(q).replace(/\\/g, "\\\\");
  const parts = columns.map((c) => `${c}.imatch."${pattern}"`);
  if (related && related.ids.length) parts.push(`${related.column}.in.(${related.ids.join(",")})`);
  return parts.join(",");
}
