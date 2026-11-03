/**
 * 5c — Activos de la empresa: lo que se compró para usar (mobiliario, decoración, equipos,
 * suministros). Solo informativo: no cambia gastos, pagos, bancos ni reportes.
 */

export const ASSET_STATUSES = ["EN_USO", "EN_REPARACION", "DADO_DE_BAJA"] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];

export const ASSET_STATUS_LABELS: Record<AssetStatus, string> = {
  EN_USO: "En uso",
  EN_REPARACION: "En reparación",
  DADO_DE_BAJA: "Dado de baja",
};

export const ASSET_STATUS_INFO: Record<AssetStatus, string> = {
  EN_USO: "Lo tenemos y se puede usar en los eventos.",
  EN_REPARACION: "Está dañado o en arreglo: no contar con él por ahora.",
  DADO_DE_BAJA: "Ya no se usa (se perdió, se dañó del todo o se regaló). Queda en la lista para el historial.",
};

export const ASSET_STATUS_TONES: Record<AssetStatus, string> = {
  EN_USO: "bg-brand-success-bg text-brand-success",
  EN_REPARACION: "bg-brand-warning-bg text-brand-warning",
  DADO_DE_BAJA: "bg-brand-surface-hover text-brand-muted",
};

export type AssetCurrency = "DOP" | "USD";

/** Cantidad sin decimales de más: 3 → «3», 1.5 → «1.5». */
export function formatQuantity(q: number | string | null | undefined): string {
  const n = Number(q ?? 0);
  return Number.isInteger(n) ? String(n) : n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

/** Qué se cambió, en palabras (historial del activo). */
export const ASSET_EVENT_LABELS: Record<string, string> = {
  CREATED: "Se registró",
  responsible: "Responsable",
  location: "Ubicación",
  status: "Estado",
  quantity: "Cantidad",
  value: "Valor",
};

export function describeAssetEventValue(field: string, value: string | null): string {
  if (value === null || value === "") return "—";
  if (field === "status") return ASSET_STATUS_LABELS[value as AssetStatus] ?? value;
  if (field === "quantity") return formatQuantity(value);
  if (field === "value") {
    const [cur, amount] = value.split(" ");
    const n = Number(amount);
    if (!Number.isFinite(n)) return value;
    return `${cur === "USD" ? "US$" : "RD$"}${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return value;
}

export function assetErrorMessage(message: string): string {
  if (message.includes("row-level security") || message.includes("permission")) return "No tienes permiso para este cambio.";
  if (message.includes("duplicate") || message.includes("uq_asset")) return "Ese nombre ya existe en la lista.";
  if (message.includes("assets_description_check")) return "Escribe qué es (al menos 2 letras).";
  if (message.includes("assets_quantity_check")) return "La cantidad debe ser mayor que cero.";
  if (message.includes("assets_value_check")) return "El valor no puede ser negativo.";
  if (message.includes("invalid_cover")) return "La portada debe ser una foto de este activo.";
  return message;
}
