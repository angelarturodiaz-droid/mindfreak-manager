import { z } from "zod";

export const INVOICE_STATUSES = [
  "DRAFT",
  "ISSUED",
  "PARTIALLY_PAID",
  "PAID",
  "OVERDUE",
  "CANCELLED",
] as const;

export const invoiceHeaderSchema = z.object({
  client_id: z.string().uuid().optional().or(z.literal("")),
  project_id: z.string().uuid().optional().or(z.literal("")),
  issue_date: z.string().min(1, "La fecha es requerida"),
  due_date: z.string().optional().or(z.literal("")),
  payment_terms_id: z.string().uuid().optional().or(z.literal("")),
  commission_percent: z.coerce.number().min(0).max(100).default(0),
  // Tratamiento fiscal de la comisión — propio e independiente del de las
  // líneas: NO hereda la exención del servicio principal. Solo obligatorio
  // si hay comisión (> 0); el servidor lo resuelve contra el catálogo de
  // Configuración → Impuestos igual que cualquier línea.
  commission_tax_rate_id: z.string().uuid().optional().or(z.literal("")),
  currency: z.enum(["DOP", "USD"]).default("DOP"),
  exchange_rate: z.coerce.number().positive().default(1),
  billing_type: z.enum(["REGULAR", "ELECTRONIC"]).default("REGULAR"),
  ncf: z.string().trim().optional().or(z.literal("")),
  ncf_type: z.string().trim().optional().or(z.literal("")),
  e_ncf: z.string().trim().optional().or(z.literal("")),
  e_ncf_valid_until: z.string().optional().or(z.literal("")),
  payment_type_code: z.enum(["1", "2"]).optional().or(z.literal("")),
});

export type InvoiceHeaderInput = z.infer<typeof invoiceHeaderSchema>;

export const invoiceItemSchema = z.object({
  service_id: z.string().uuid().optional().or(z.literal("")),
  description: z.string().trim().min(1, "La descripción es requerida"),
  quantity: z.coerce.number().positive("Debe ser mayor a 0"),
  unit_price: z.coerce.number().min(0),
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
  // importar la tasa configurada — ver addInvoiceItemAction.
  tax_rate_id: z.string().uuid("Selecciona un tratamiento fiscal"),
});

export type InvoiceItemInput = z.infer<typeof invoiceItemSchema>;

export function calculateInvoiceItemSubtotal(item: {
  quantity: number;
  unit_price: number;
  discount: number;
  tax: number;
}): number {
  const base = item.quantity * item.unit_price;
  return Math.max(0, base - item.discount + item.tax);
}

/**
 * Comisión de la empresa (% sobre el subtotal): se suma ANTES del
 * descuento y ANTES del impuesto. Su ITBIS se calcula con su PROPIO
 * tratamiento fiscal (Gravada/Exenta/No sujeta), configurado aparte de
 * las líneas — NUNCA hereda ni prorratea la exención de otras líneas del
 * documento. Si es Gravada, el % se aplica únicamente sobre el monto de
 * la comisión; si es Exenta o No sujeta, su ITBIS es 0.
 * Orden: Subtotal + Comisión − Descuento + ITBIS = Total.
 */
export function calculateInvoiceTotals(
  items: { quantity: number; unit_price: number; discount: number; tax: number }[],
  commissionPercent = 0,
  commissionTaxTreatment: "GRAVADO" | "EXENTO" | "NO_SUJETO" = "GRAVADO",
  commissionTaxRatePercent = 0,
) {
  let subtotal = 0;
  let discount = 0;
  let lineTax = 0;
  for (const item of items) {
    subtotal += item.quantity * item.unit_price;
    discount += item.discount;
    lineTax += item.tax;
  }
  const commissionAmount = subtotal * (commissionPercent / 100);
  const commissionTax =
    commissionTaxTreatment === "GRAVADO" ? commissionAmount * (commissionTaxRatePercent / 100) : 0;
  const tax = lineTax + commissionTax;
  const total = Math.max(0, subtotal + commissionAmount - discount + tax);
  return { subtotal, commission_amount: commissionAmount, discount, tax, total };
}
