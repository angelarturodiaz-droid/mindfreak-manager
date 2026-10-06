import { z } from "zod";
import { currencyCodeSchema } from "@/features/currencies/schema";

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
  // Código ISO de 3 letras; se valida contra el catálogo de monedas activas en la acción.
  currency: currencyCodeSchema.default("DOP"),
  exchange_rate: z.coerce.number().positive().default(1),
  // Informativo, nunca afecta ningún cálculo: a qué banco del PROVEEDOR se
  // le depositó (distinto de bank_account_id, que es siempre la cuenta
  // PROPIA de origen del dinero).
  payee_bank_name: z.string().trim().optional().or(z.literal("")),
  // Tratamiento fiscal (migración 074): de qué tipo de servicio es el gasto
  // y qué comprobante entregó el proveedor. El servidor calcula las
  // retenciones con el motor fiscal; el formulario solo las muestra.
  service_type_id: z.string().uuid().optional().or(z.literal("")),
  document_type: z.string().trim().max(10).optional().or(z.literal("")),
  ncf: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^(B\d{10}|E\d{12})$/, "El NCF no tiene el formato correcto (ej. B0100000123 o E310000000123).")
    .optional()
    .or(z.literal("")),
}).refine(
  (d) => !d.ncf || !d.document_type || d.document_type === "NONE" || d.ncf.startsWith(d.document_type),
  { message: "El NCF no corresponde al tipo de comprobante elegido (debe empezar igual, ej. B01…).", path: ["ncf"] },
);

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
