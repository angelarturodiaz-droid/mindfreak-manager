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
  { key: "web", label: "Página web", placeholder: "https://…" },
  { key: "instagram", label: "Instagram", placeholder: "https://instagram.com/…" },
  { key: "video", label: "Video", placeholder: "https://youtube.com/…" },
  { key: "map", label: "Mapa", placeholder: "https://maps.google.com/…" },
] as const;

export type DirectoryLinks = Partial<Record<(typeof LINK_FIELDS)[number]["key"], string>>;

/** Solo enlaces http(s) (evita «javascript:» y similares). */
export function cleanLink(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  const withProto = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(withProto);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export function directoryErrorMessage(message: string): string {
  if (message.includes("has_history")) return "Ya tiene gastos o pagos registrados: solo puede quedar como Proveedor o Inactivo.";
  if (message.includes("duplicate") || message.includes("uq_directory")) return "Ese nombre ya existe en la lista.";
  if (message.includes("row-level security")) return "No tienes permiso para este cambio.";
  return message;
}
