/**
 * Prefijos de los números internos de los documentos (en español).
 * El número oficial para la DGII es el NCF; este es solo el interno.
 * Desde el 20-oct: facturas FAC- (antes INV-) y proyectos PROY- (antes PROJ-).
 * Los documentos que ya existen conservan su número; la numeración sigue
 * sin saltos porque se toma el mayor número existente, sea cual sea el prefijo.
 */
export const DOC_PREFIX = {
  invoice: "FAC",
  project: "PROY",
  quotation: "COT",
  delivery: "ACU",
} as const;

/** Siguiente número: PREFIJO-0001, a partir del mayor de los números existentes. */
export function nextDocNumber(prefix: string, existing: (string | null | undefined)[]): string {
  const max = existing.reduce<number>((m, num) => {
    const n = parseInt(String(num ?? "").replace(/\D/g, ""), 10);
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  return `${prefix}-${String(max + 1).padStart(4, "0")}`;
}
