import type { BadgeTone } from "@/components/ui/badge";

/** Estado fiscal de un gasto (expenses.fiscal_status, migración 074). */
export const EXPENSE_FISCAL_STATUS_LABELS: Record<string, string> = {
  NOT_EVALUATED: "Sin evaluar",
  NO_SUPPLIER: "Sin proveedor",
  MISSING_DATA: "Faltan datos",
  NO_RULE: "Sin regla",
  REVIEW: "Por revisar",
  BLOCKED: "Bloqueado",
  NO_RETENTION: "Sin retención",
  APPLIED: "Con retenciones",
  OVERRIDDEN: "Ajuste manual",
};

export const EXPENSE_FISCAL_STATUS_TONE: Record<string, BadgeTone> = {
  NOT_EVALUATED: "neutral",
  NO_SUPPLIER: "neutral",
  MISSING_DATA: "warning",
  NO_RULE: "warning",
  REVIEW: "warning",
  BLOCKED: "danger",
  NO_RETENTION: "success",
  APPLIED: "info",
  OVERRIDDEN: "info",
};

/** Qué significa cada estado, en una línea (tooltip del chip). */
export const EXPENSE_FISCAL_STATUS_HINTS: Record<string, string> = {
  NOT_EVALUATED: "Gasto registrado antes de las reglas fiscales: se paga el total, sin retenciones.",
  NO_SUPPLIER: "Gasto sin proveedor: no se calculan retenciones.",
  MISSING_DATA: "Falta información del proveedor o del tipo de servicio. Se paga el total hasta completarla y recalcular.",
  NO_RULE: "Ninguna regla fiscal vigente aplica. Se paga el total; revísalo con tu contador.",
  REVIEW: "La regla pide que alguien revise este caso antes de pagar.",
  BLOCKED: "Una regla no permite esta combinación.",
  NO_RETENTION: "Según la regla vigente no se retiene nada: se paga el total.",
  APPLIED: "Se retiene parte del pago para la DGII; al proveedor se le paga el neto.",
  OVERRIDDEN: "Alguien con permiso ajustó a mano el tratamiento fiscal, con un motivo registrado.",
};

/** Estados que cuentan como "Revisión fiscal" en el listado de gastos. */
export const EXPENSE_FISCAL_REVIEW = ["MISSING_DATA", "NO_RULE", "REVIEW"];
