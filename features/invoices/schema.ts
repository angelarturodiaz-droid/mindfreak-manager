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
  currency: z.enum(["DOP", "USD"]).default("DOP"),
  exchange_rate: z.coerce.number().positive().default(1),
  ncf: z.string().trim().optional().or(z.literal("")),
  ncf_type: z.string().trim().optional().or(z.literal("")),
});

export type InvoiceHeaderInput = z.infer<typeof invoiceHeaderSchema>;

export const invoiceItemSchema = z.object({
  service_id: z.string().uuid().optional().or(z.literal("")),
  description: z.string().trim().min(1, "La descripción es requerida"),
  quantity: z.coerce.number().positive("Debe ser mayor a 0"),
  unit_price: z.coerce.number().min(0),
  discount: z.coerce.number().min(0).default(0),
  tax: z.coerce.number().min(0).default(0),
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

export function calculateInvoiceTotals(
  items: { quantity: number; unit_price: number; discount: number; tax: number }[],
) {
  let subtotal = 0;
  let discount = 0;
  let tax = 0;
  for (const item of items) {
    subtotal += item.quantity * item.unit_price;
    discount += item.discount;
    tax += item.tax;
  }
  const total = Math.max(0, subtotal - discount + tax);
  return { subtotal, discount, tax, total };
}
