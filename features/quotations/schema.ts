import { z } from "zod";

export const QUOTATION_STATUSES = [
  "DRAFT",
  "SENT",
  "VIEWED",
  "NEGOTIATING",
  "APPROVED",
  "REJECTED",
  "EXPIRED",
  "CANCELLED",
] as const;

export const quotationHeaderSchema = z.object({
  client_id: z.string().uuid("Selecciona un cliente"),
  contact_id: z.string().uuid().optional().or(z.literal("")),
  issue_date: z.string().min(1, "La fecha es requerida"),
  valid_until: z.string().optional().or(z.literal("")),
  currency: z.enum(["DOP", "USD"]).default("DOP"),
  exchange_rate: z.coerce.number().positive().default(1),
  terms: z.string().trim().optional().or(z.literal("")),
  payment_terms_id: z.string().uuid().optional().or(z.literal("")),
  commission_percent: z.coerce.number().min(0).max(100).default(0),
  // Tratamiento fiscal de la comisión — propio e independiente del de las
  // líneas: NO hereda la exención del servicio principal.
  commission_tax_rate_id: z.string().uuid().optional().or(z.literal("")),
});

export type QuotationHeaderInput = z.infer<typeof quotationHeaderSchema>;

export const quotationItemSchema = z.object({
  service_id: z.string().uuid().optional().or(z.literal("")),
  description: z.string().trim().min(1, "La descripción es requerida"),
  quantity: z.coerce.number().positive("Debe ser mayor a 0"),
  unit_price: z.coerce.number().min(0, "Debe ser un número positivo"),
  // El usuario escribe el % de descuento (igual que con el Impuesto), y el
  // Server Action calcula el monto en dólares sobre (cantidad×precio) antes
  // de guardarlo — la columna `discount` en la base de datos sigue siendo
  // un monto, no un %, así que no hace falta ninguna migración de datos.
  discount_percent: z.coerce.number().min(0).max(100).default(0),
  // El tratamiento fiscal y la tasa SIEMPRE se eligen del catálogo de
  // Configuración → Impuestos (tax_rates) — nunca un % suelto. El servidor
  // resuelve este id contra la tabla (nombre, tasa, tratamiento) y congela
  // una copia en la línea (tax_treatment, tax_rate_percent) para que el
  // historial no cambie si luego se edita o desactiva la tasa. Si el
  // tratamiento es Exento o No sujeto, el impuesto de la línea es 0 sin
  // importar la tasa configurada — ver addQuotationItemAction.
  tax_rate_id: z.string().uuid("Selecciona un tratamiento fiscal"),
  estimated_unit_cost: z.coerce.number().min(0).default(0),
});

export type QuotationItemInput = z.infer<typeof quotationItemSchema>;

/**
 * Cálculo de una línea: subtotal = (cantidad × precio) − descuento + impuesto.
 * Ver F0-Arquitectura, sección G (quotation_items).
 */
export function calculateItemSubtotal(item: {
  quantity: number;
  unit_price: number;
  discount: number;
  tax: number;
}): number {
  const base = item.quantity * item.unit_price;
  return Math.max(0, base - item.discount + item.tax);
}

export function calculateItemEstimatedCost(item: {
  quantity: number;
  estimated_unit_cost: number;
}): number {
  return item.quantity * item.estimated_unit_cost;
}

/**
 * Agrega los totales de la cotización a partir de sus líneas.
 * Comisión de la empresa (% sobre el subtotal): se suma ANTES del
 * descuento y ANTES del impuesto — participa en la base sobre la que se
 * calcula el ITBIS (con la tasa efectiva del documento). Orden: Subtotal
 * + Comisión − Descuento + ITBIS = Total.
 */
export function calculateQuotationTotals(
  items: {
    quantity: number;
    unit_price: number;
    discount: number;
    tax: number;
    estimated_unit_cost: number;
  }[],
  commissionPercent = 0,
  commissionTaxTreatment: "GRAVADO" | "EXENTO" | "NO_SUJETO" = "GRAVADO",
  commissionTaxRatePercent = 0,
) {
  let subtotal = 0;
  let discount = 0;
  let lineTax = 0;
  let estimatedCost = 0;

  for (const item of items) {
    subtotal += item.quantity * item.unit_price;
    discount += item.discount;
    lineTax += item.tax;
    estimatedCost += calculateItemEstimatedCost(item);
  }

  // La comisión tiene su propio tratamiento fiscal (Gravada/Exenta/No
  // sujeta) — NUNCA hereda ni prorratea la exención de otras líneas. Si es
  // Gravada, el % se aplica únicamente sobre el monto de la comisión.
  const commissionAmount = subtotal * (commissionPercent / 100);
  const commissionTax =
    commissionTaxTreatment === "GRAVADO" ? commissionAmount * (commissionTaxRatePercent / 100) : 0;
  const tax = lineTax + commissionTax;

  const total = Math.max(0, subtotal + commissionAmount - discount + tax);
  const estimatedMargin = total > 0 ? ((total - estimatedCost) / total) * 100 : 0;

  return {
    subtotal,
    commission_amount: commissionAmount,
    discount,
    tax,
    total,
    estimated_cost: estimatedCost,
    estimated_margin: estimatedMargin,
  };
}
