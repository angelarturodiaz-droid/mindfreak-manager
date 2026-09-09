import { z } from "zod";

export const EXPENSE_STATUSES = [
  "PENDING",
  "PARTIALLY_PAID",
  "PAID",
  "CANCELLED",
] as const;

export const expenseSchema = z.object({
  category_id: z.string().uuid().optional().or(z.literal("")),
  supplier_id: z.string().uuid().optional().or(z.literal("")),
  project_id: z.string().uuid().optional().or(z.literal("")),
  bank_account_id: z.string().uuid().optional().or(z.literal("")),
  expense_date: z.string().min(1, "La fecha es requerida"),
  description: z.string().trim().min(1, "La descripción es requerida"),
  subtotal: z.coerce.number().min(0, "Debe ser un número positivo"),
  // Igual que en cotizaciones/facturas: se escribe el % y el servidor
  // calcula el monto de impuesto sobre el subtotal.
  tax_percent: z.coerce.number().min(0).default(0),
  payment_method: z.string().optional().or(z.literal("")),
  currency: z.enum(["DOP", "USD"]).default("DOP"),
  exchange_rate: z.coerce.number().positive().default(1),
});

export type ExpenseInput = z.infer<typeof expenseSchema>;

/** Gastos no tienen descuento (a diferencia de cotizaciones/facturas). */
export function calculateExpenseTotals(input: {
  subtotal: number;
  tax_percent: number;
}) {
  const tax = Math.round(Math.max(0, input.subtotal) * (input.tax_percent / 100) * 100) / 100;
  const total = input.subtotal + tax;
  return { tax, total };
}
