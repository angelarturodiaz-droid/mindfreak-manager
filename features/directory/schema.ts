/**
 * 5 — Directorio de Recursos y Aliados. Un proveedor que todavía no lo es:
 * PROSPECTO → EVALUADO → APROBADO → PROVEEDOR (+ INACTIVO).
 */

export const DIRECTORY_STATUSES = ["PROSPECTO", "EVALUADO", "APROBADO", "PROVEEDOR", "INACTIVO"] as const;
export type DirectoryStatus = (typeof DIRECTORY_STATUSES)[number];

/** Pasos del avance (Inactivo va aparte). */
export const DIRECTORY_FLOW: DirectoryStatus[] = ["PROSPECTO", "EVALUADO", "APROBADO", "PROVEEDOR"];

export const DIRECTORY_STATUS_LABELS: Record<DirectoryStatus, string> = {
  PROSPECTO: "Prospecto",
  EVALUADO: "Evaluado",
  APROBADO: "Aprobado",
  PROVEEDOR: "Proveedor",
  INACTIVO: "Inactivo",
};

export const DIRECTORY_STATUS_INFO: Record<DirectoryStatus, string> = {
  PROSPECTO: "Lo conocimos o nos lo recomendaron, pero todavía no lo hemos evaluado.",
  EVALUADO: "Ya lo vimos (precio, calidad, fotos): tiene calificación y notas.",
  APROBADO: "Podemos contratarlo cuando haga falta. Aún no le hemos pagado.",
  PROVEEDOR: "Ya trabajamos con él: tiene (o puede tener) gastos y pagos. Sale al registrar un gasto.",
  INACTIVO: "No se usa por ahora. No sale al registrar gastos nuevos; su historial queda igual.",
};

export const DIRECTORY_STATUS_TONES: Record<DirectoryStatus, string> = {
  PROSPECTO: "bg-brand-surface-hover text-brand-muted",
  EVALUADO: "bg-brand-info-bg text-brand-info",
  APROBADO: "bg-brand-accent-light text-brand-accent",
  PROVEEDOR: "bg-brand-success-bg text-brand-success",
  INACTIVO: "bg-brand-danger-bg text-brand-danger",
};

/** «Siguiente paso» de la ficha, en lenguaje sencillo. */
export function directoryNextStep(status: DirectoryStatus): { text: string; to: DirectoryStatus | null; button: string | null } {
  switch (status) {
    case "PROSPECTO":
      return {
        text: "evalúalo: ponle calificación, precio de referencia y notas (y sube fotos si tienes). Luego márcalo Evaluado.",
        to: "EVALUADO",
        button: "Marcar como evaluado",
      };
    case "EVALUADO":
      return { text: "si nos sirve, márcalo Aprobado para tenerlo a mano cuando haga falta.", to: "APROBADO", button: "Marcar como aprobado" };
    case "APROBADO":
      return {
        text: "cuando lo contrates, conviértelo en Proveedor (o regístrale un gasto: se convierte solo). Recomendado: RNC/cédula y tipo fiscal.",
        to: "PROVEEDOR",
        button: "Convertir en proveedor",
      };
    case "PROVEEDOR":
      return { text: "ya es proveedor: sale al registrar gastos.", to: null, button: null };
    default:
      return { text: "está inactivo: no sale al registrar gastos nuevos.", to: null, button: null };
  }
}

export const LINK_FIELDS = [
  { key: "web", label: "Página web", placeholder: "https://…", example: "www.sunegocio.com" },
  { key: "instagram", label: "Instagram", placeholder: "https://instagram.com/…", example: "instagram.com/sunegocio" },
  { key: "video", label: "Video", placeholder: "https://youtube.com/…", example: "youtube.com/watch?v=…" },
  { key: "map", label: "Mapa", placeholder: "https://maps.google.com/…", example: "maps.app.goo.gl/…" },
] as const;

export type DirectoryLinks = Partial<Record<(typeof LINK_FIELDS)[number]["key"], string>>;

/** Solo enlaces http(s) con un dominio real (evita «javascript:», «hola mundo», «https://hola/»). */
export function cleanLink(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (/\s/.test(v)) return null;
  const withProto = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(withProto);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    // Debe tener un dominio con punto (ej. youtube.com), no una palabra suelta.
    const parts = u.hostname.split(".");
    if (parts.length < 2 || parts.some((p) => !p) || parts[parts.length - 1].length < 2) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** Mensaje para un enlace que no es una dirección web. */
export function invalidLinkMessage(label: string, example: string): string {
  return `El enlace de «${label}» no es una dirección web. Escríbelo completo, por ejemplo: ${example}`;
}

const MONEY_FMT = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Precio de referencia (texto libre) con comas y punto: «15000» → «RD$15,000.00»;
 * «desde RD$15000 por hora» → «desde RD$15,000.00 por hora». Los números chicos sin moneda
 * («3 horas», «100 personas») y los años («2026») quedan igual.
 */
export function formatPriceText(value: string | null | undefined): string {
  const t = (value ?? "").trim().replace(/\s+/g, " ");
  if (!t) return "";
  if (/^\d[\d,]*(\.\d+)?$/.test(t)) {
    const n = Number(t.replace(/,/g, ""));
    return Number.isFinite(n) ? `RD$${MONEY_FMT.format(n)}` : t;
  }
  return t.replace(/(RD\$|US\$|\$)?\s?(\d[\d,]*(?:\.\d+)?)/g, (match, cur: string | undefined, num: string) => {
    const digits = num.replace(/,/g, "");
    const n = Number(digits);
    if (!Number.isFinite(n)) return match;
    const intPart = digits.split(".")[0];
    if (!cur && (intPart.length < 4 || (intPart.length === 4 && /^(19|20)\d\d$/.test(intPart) && !digits.includes(".")))) return match;
    const lead = match.startsWith(" ") ? " " : "";
    return `${lead}${cur ?? ""}${MONEY_FMT.format(n)}`;
  });
}

export function directoryErrorMessage(message: string): string {
  if (message.includes("has_history")) return "Ya tiene gastos o pagos registrados: solo puede quedar como Proveedor o Inactivo.";
  if (message.includes("duplicate") || message.includes("uq_directory")) return "Ese nombre ya existe en la lista.";
  if (message.includes("row-level security")) return "No tienes permiso para este cambio.";
  return message;
}
