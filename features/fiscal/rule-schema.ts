import { z } from "zod";
import { FISCAL_CONDITION_LABELS, SUPPLIER_KIND_LABELS } from "@/features/suppliers/fiscal";

/** Tipos de comprobante fiscal (NCF y e-CF) que se pueden recibir de un proveedor. */
export const DOCUMENT_TYPES: { code: string; label: string }[] = [
  { code: "B01", label: "B01 · Crédito fiscal" },
  { code: "B02", label: "B02 · Consumo" },
  { code: "B11", label: "B11 · Comprobante de compras (informales)" },
  { code: "B13", label: "B13 · Gastos menores" },
  { code: "B14", label: "B14 · Regímenes especiales" },
  { code: "B15", label: "B15 · Gubernamental" },
  { code: "B16", label: "B16 · Exportaciones" },
  { code: "B17", label: "B17 · Pagos al exterior" },
  { code: "E31", label: "E31 · Crédito fiscal electrónico" },
  { code: "E32", label: "E32 · Consumo electrónico" },
  { code: "E41", label: "E41 · Compras electrónico" },
  { code: "E43", label: "E43 · Gastos menores electrónico" },
  { code: "E44", label: "E44 · Regímenes especiales electrónico" },
  { code: "E45", label: "E45 · Gubernamental electrónico" },
  { code: "E46", label: "E46 · Exportaciones electrónico" },
  { code: "E47", label: "E47 · Pagos al exterior electrónico" },
  { code: "NONE", label: "Sin comprobante" },
];

export const RULE_ACTIONS = ["RETAIN", "NO_RETENTION", "REVIEW", "BLOCK"] as const;
export const RULE_ACTION_LABELS: Record<string, string> = {
  RETAIN: "Aplicar retenciones",
  NO_RETENTION: "No retener (se paga el total)",
  REVIEW: "Pedir revisión manual",
  BLOCK: "Bloquear (no permitir esta combinación)",
};
export const RULE_STATE_LABELS: Record<string, string> = {
  ACTIVE: "Vigente",
  SCHEDULED: "Programada",
  EXPIRED: "Vencida",
  INACTIVE: "Inactiva",
};
export const RULE_STATE_TONE: Record<string, "success" | "info" | "neutral" | "warning"> = {
  ACTIVE: "success",
  SCHEDULED: "info",
  EXPIRED: "neutral",
  INACTIVE: "warning",
};
export const REPORT_TAGS = ["606", "607", "608", "609", "IR-17", "IT-1"] as const;

const pct = z.coerce.number().min(0, "Mínimo 0 %").max(100, "Máximo 100 %");
const list = z.array(z.string()).default([]);

export const fiscalRuleSchema = z
  .object({
    name: z.string().trim().min(3, "Escribe un nombre para la regla.").max(120),
    description: z.string().trim().max(500).optional().or(z.literal("")),
    priority: z.coerce.number().int().min(1).max(999).default(50),
    is_active: z.boolean().default(true),
    valid_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Indica desde cuándo es vigente."),
    valid_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
    supplier_kinds: list,
    fiscal_conditions: list,
    tax_residence: z.enum(["DO", "EXTRANJERO"]).optional().or(z.literal("")),
    country_code: z.string().trim().toUpperCase().optional().or(z.literal("")),
    fiscal_classification_id: z.string().uuid().optional().or(z.literal("")),
    document_types: list,
    e_issuer: z.enum(["SI", "NO", "NO_CONFIRMADO"]).optional().or(z.literal("")),
    action: z.enum(RULE_ACTIONS),
    isr_rate: pct.default(0),
    isr_base_pct: pct.default(100),
    itbis_retention_pct: pct.default(0),
    report_tags: list,
    user_message: z.string().trim().max(300).optional().or(z.literal("")),
    legal_source: z.string().trim().max(200).optional().or(z.literal("")),
    legal_article: z.string().trim().max(200).optional().or(z.literal("")),
    reference_url: z.string().trim().url("La referencia debe ser un enlace (https://…).").optional().or(z.literal("")),
    notes: z.string().trim().max(1000).optional().or(z.literal("")),
  })
  .superRefine((r, ctx) => {
    if (r.valid_to && r.valid_to < r.valid_from) {
      ctx.addIssue({ code: "custom", message: "La fecha final no puede ser antes de la inicial." });
    }
    if (r.action === "RETAIN" && Number(r.isr_rate) === 0 && Number(r.itbis_retention_pct) === 0) {
      ctx.addIssue({ code: "custom", message: "Para aplicar retenciones indica el % de ISR o de ITBIS retenido." });
    }
    if (r.isr_base_pct === 0 && r.isr_rate > 0) {
      ctx.addIssue({ code: "custom", message: "La base de cálculo del ISR no puede ser 0 %." });
    }
  });

export type FiscalRuleInput = z.infer<typeof fiscalRuleSchema>;

/** "Persona Física · Registrado DGII · Servicio técnico" (para la columna "Aplica a"). */
export function describeConditions(
  r: {
    supplier_kinds: string[] | null;
    fiscal_conditions: string[] | null;
    tax_residence: string | null;
    country_code: string | null;
    fiscal_classification_id: string | null;
    document_types: string[] | null;
    e_issuer: string | null;
  },
  classificationName: (id: string) => string | undefined,
): string {
  const parts: string[] = [];
  if (r.tax_residence === "EXTRANJERO") parts.push(`Proveedor extranjero${r.country_code ? ` (${r.country_code})` : ""}`);
  if (r.supplier_kinds?.length) parts.push(r.supplier_kinds.map((k) => SUPPLIER_KIND_LABELS[k] ?? k).join(" o "));
  if (r.fiscal_conditions?.length) parts.push(r.fiscal_conditions.map((c) => FISCAL_CONDITION_LABELS[c] ?? c).join(" o "));
  if (r.fiscal_classification_id) parts.push(classificationName(r.fiscal_classification_id) ?? "Clasificación");
  if (r.document_types?.length) parts.push(`Comprobante ${r.document_types.join("/")}`);
  if (r.e_issuer === "SI") parts.push("Emisor e-CF");
  if (r.e_issuer === "NO") parts.push("No emisor e-CF");
  return parts.join(" · ") || "Cualquier operación";
}
