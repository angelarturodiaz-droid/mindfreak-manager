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
  discount: z.coerce.number().min(0).default(0),
  // Igual que en cotizaciones: el usuario escribe el % (ej. 18 = ITBIS 18%)
  // y el monto se calcula en el servidor sobre (cantidad×precio − descuento).
  tax_percent: z.coerce.number().min(0).default(0),
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
 * descuento y ANTES del impuesto — participa en la base sobre la que se
 * calcula el ITBIS. El impuesto de la comisión usa la tasa EFECTIVA del
 * documento (tax/subtotal de las líneas), para quedar consistente aunque
 * haya líneas con distintas tasas o exentas.
 * Orden: Subtotal + Comisión − Descuento + ITBIS = Total.
 */
export function calculateInvoiceTotals(
  items: { quantity: number; unit_price: number; discount: number; tax: number }[],
  commissionPercent = 0,
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
  const effectiveTaxRate = subtotal > 0 ? lineTax / subtotal : 0;
  const commissionTax = commissionAmount * effectiveTaxRate;
  const tax = lineTax + commissionTax;
  const total = Math.max(0, subtotal + commissionAmount - discount + tax);
  return { subtotal, commission_amount: commissionAmount, discount, tax, total };
}
