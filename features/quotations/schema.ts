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
});

export type QuotationHeaderInput = z.infer<typeof quotationHeaderSchema>;

export const quotationItemSchema = z.object({
  service_id: z.string().uuid().optional().or(z.literal("")),
  description: z.string().trim().min(1, "La descripción es requerida"),
  quantity: z.coerce.number().positive("Debe ser mayor a 0"),
  unit_price: z.coerce.number().min(0, "Debe ser un número positivo"),
  discount: z.coerce.number().min(0).default(0),
  tax: z.coerce.number().min(0).default(0),
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

/** Agrega los totales de la cotización a partir de sus líneas. */
export function calculateQuotationTotals(
  items: {
    quantity: number;
    unit_price: number;
    discount: number;
    tax: number;
    estimated_unit_cost: number;
  }[],
) {
  let subtotal = 0;
  let discount = 0;
  let tax = 0;
  let estimatedCost = 0;

  for (const item of items) {
    subtotal += item.quantity * item.unit_price;
    discount += item.discount;
    tax += item.tax;
    estimatedCost += calculateItemEstimatedCost(item);
  }

  const total = Math.max(0, subtotal - discount + tax);
  const estimatedMargin = total > 0 ? ((total - estimatedCost) / total) * 100 : 0;

  return {
    subtotal,
    discount,
    tax,
    total,
    estimated_cost: estimatedCost,
    estimated_margin: estimatedMargin,
  };
}
