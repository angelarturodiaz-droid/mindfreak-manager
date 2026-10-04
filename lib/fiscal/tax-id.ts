/**
 * RNC / Cédula de República Dominicana.
 *
 * - Se normaliza quitando guiones y espacios (se guarda tal como lo escribió
 *   el usuario; esto solo es para validar y sugerir).
 * - 9 dígitos → parece RNC → se SUGIERE Persona Jurídica.
 * - 11 dígitos → parece Cédula → se SUGIERE Persona Física.
 * - La longitud nunca decide la condición fiscal (registrado, informal, RST):
 *   eso lo confirma el usuario.
 * - El dígito verificador se revisa solo para avisar ("revisa que esté bien
 *   escrito"), nunca bloquea.
 * - Preparado para una consulta futura autorizada a la DGII: ver verifyTaxId.
 */

export type TaxIdKind = "RNC" | "CEDULA" | "UNKNOWN" | "EMPTY";

export function normalizeTaxId(value: string | null | undefined): string {
  return (value ?? "").replace(/[\s\-.]/g, "");
}

/** 1-01-12345-6 para RNC · 001-1234567-8 para Cédula; si no, tal cual. */
export function formatTaxId(value: string | null | undefined): string {
  const d = normalizeTaxId(value);
  if (/^\d{9}$/.test(d)) return `${d[0]}-${d.slice(1, 3)}-${d.slice(3, 8)}-${d[8]}`;
  if (/^\d{11}$/.test(d)) return `${d.slice(0, 3)}-${d.slice(3, 10)}-${d[10]}`;
  return (value ?? "").trim();
}

/** Dígito verificador del RNC (pesos 7,9,8,6,5,4,3,2 · módulo 11). */
export function isValidRnc(digits: string): boolean {
  if (!/^\d{9}$/.test(digits)) return false;
  const weights = [7, 9, 8, 6, 5, 4, 3, 2];
  const sum = weights.reduce((acc, w, i) => acc + w * Number(digits[i]), 0);
  const mod = sum % 11;
  const check = mod === 0 ? 2 : mod === 1 ? 1 : 11 - mod;
  return check === Number(digits[8]);
}

/** Dígito verificador de la Cédula (pesos 1,2 alternos · módulo 10). */
export function isValidCedula(digits: string): boolean {
  if (!/^\d{11}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    let p = Number(digits[i]) * (i % 2 === 0 ? 1 : 2);
    if (p >= 10) p = Math.floor(p / 10) + (p % 10);
    sum += p;
  }
  const check = (10 - (sum % 10)) % 10;
  return check === Number(digits[10]);
}

export type TaxIdAnalysis = {
  kind: TaxIdKind;
  digits: string;
  formatted: string;
  /** El dígito verificador no cuadra (puede ser un error de escritura). */
  checksumOk: boolean | null;
  suggestedIdType: "RNC" | "CEDULA" | null;
  suggestedSupplierKind: "PERSONA_JURIDICA" | "PERSONA_FISICA" | null;
  /** Mensaje sencillo para mostrar debajo del campo. */
  message: string | null;
  tone: "info" | "warning" | null;
};

export function analyzeTaxId(value: string | null | undefined): TaxIdAnalysis {
  const digits = normalizeTaxId(value);
  const base = { digits, formatted: formatTaxId(value) };
  if (!digits) {
    return { ...base, kind: "EMPTY", checksumOk: null, suggestedIdType: null, suggestedSupplierKind: null, message: null, tone: null };
  }
  if (/^\d{11}$/.test(digits)) {
    const ok = isValidCedula(digits);
    return {
      ...base,
      kind: "CEDULA",
      checksumOk: ok,
      suggestedIdType: "CEDULA",
      suggestedSupplierKind: "PERSONA_FISICA",
      message: ok
        ? "Parece ser una Cédula. Hemos sugerido Persona Física. Confirma su condición fiscal."
        : "Parece ser una Cédula, pero el último dígito no cuadra: revisa que esté bien escrita. Hemos sugerido Persona Física.",
      tone: ok ? "info" : "warning",
    };
  }
  if (/^\d{9}$/.test(digits)) {
    const ok = isValidRnc(digits);
    return {
      ...base,
      kind: "RNC",
      checksumOk: ok,
      suggestedIdType: "RNC",
      suggestedSupplierKind: "PERSONA_JURIDICA",
      message: ok
        ? "Parece ser un RNC. Hemos sugerido Persona Jurídica. Puedes modificarlo si corresponde."
        : "Parece ser un RNC, pero el último dígito no cuadra: revisa que esté bien escrito. Hemos sugerido Persona Jurídica.",
      tone: ok ? "info" : "warning",
    };
  }
  return {
    ...base,
    kind: "UNKNOWN",
    checksumOk: null,
    suggestedIdType: null,
    suggestedSupplierKind: null,
    message: /^\d+$/.test(digits)
      ? `Tiene ${digits.length} dígitos: un RNC tiene 9 y una Cédula 11. Revísalo (si es un proveedor extranjero, márcalo abajo).`
      : "No parece un RNC ni una Cédula dominicana. Si es un proveedor extranjero, márcalo abajo.",
    tone: "warning",
  };
}

/**
 * Punto de extensión para una validación futura autorizada contra la DGII
 * (estado del contribuyente, nombre, régimen, emisor electrónico). Hoy solo
 * valida el formato localmente.
 */
export async function verifyTaxId(value: string): Promise<{ source: "local"; analysis: TaxIdAnalysis }> {
  return { source: "local", analysis: analyzeTaxId(value) };
}
