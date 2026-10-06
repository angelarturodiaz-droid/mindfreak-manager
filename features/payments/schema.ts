import { z } from "zod";

export const PAYMENT_METHODS = [
  "TRANSFER",
  "DEPOSIT",
  "CHECK",
  "CARD",
  "CASH",
  "OTHER",
] as const;

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  TRANSFER: "Transferencia",
  DEPOSIT: "Depósito",
  CHECK: "Cheque",
  CARD: "Tarjeta",
  CASH: "Efectivo",
  OTHER: "Otro",
};

export const registerPaymentSchema = z.object({
  bank_account_id: z.string().uuid("Debes elegir una cuenta bancaria"),
  payment_date: z.string().min(1, "La fecha es requerida"),
  amount: z.coerce.number().positive("El monto debe ser mayor a 0"),
  method: z.enum(PAYMENT_METHODS),
  reference: z.string().trim().optional().or(z.literal("")),
  notes: z.string().trim().optional().or(z.literal("")),
  /** Solo cobros: categoría del movimiento de banco. Vacío = automática ("Cobro de factura"). */
  category_id: z.string().uuid("Categoría inválida").optional().or(z.literal("")),
});

export type RegisterPaymentInput = z.infer<typeof registerPaymentSchema>;

/**
 * Datos del bloque "Pago/Cobro en moneda diferente" (multimoneda V5). Todos
 * opcionales: con la cuenta en la misma moneda del documento no se envían.
 * El servidor (fx_settlement en la base) recalcula y valida todo.
 */
const optionalPositive = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.coerce.number().positive().optional(),
);
export const foreignPaymentSchema = z.object({
  account_amount: optionalPositive,
  bank_fee: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    z.coerce.number().min(0, "La comisión no puede ser negativa.").optional(),
  ),
  reference_rate: optionalPositive,
  reference_rate_document: optionalPositive,
  reference_rate_source: z.enum(["BCRD_DGII", "MANUAL", "BANK", "OTHER"]).optional().or(z.literal("")),
  rate_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  rate_manual_override: z.boolean().default(false),
  rate_previous: optionalPositive,
});
export type ForeignPaymentInput = z.infer<typeof foreignPaymentSchema>;

export function parseForeignPayment(formData: FormData) {
  const get = (k: string) => {
    const v = formData.get(k);
    return v === null ? undefined : String(v);
  };
  return foreignPaymentSchema.safeParse({
    account_amount: get("account_amount"),
    bank_fee: get("bank_fee"),
    reference_rate: get("reference_rate"),
    reference_rate_document: get("reference_rate_document"),
    reference_rate_source: get("reference_rate_source") ?? "",
    rate_date: get("rate_date") ?? "",
    rate_manual_override: formData.get("rate_manual_override") === "1",
    rate_previous: get("rate_previous"),
  });
}

/** Parámetros opcionales de las funciones de pago (migración 076). */
export function foreignPaymentRpcParams(f: ForeignPaymentInput) {
  return {
    p_account_amount: f.account_amount ?? null,
    p_bank_fee: f.bank_fee && f.bank_fee > 0 ? f.bank_fee : null,
    p_reference_rate: f.reference_rate ?? null,
    p_reference_rate_document: f.reference_rate_document ?? null,
    p_reference_rate_source: f.reference_rate_source || null,
    p_rate_date: f.rate_date || null,
    p_rate_manual_override: f.rate_manual_override,
    p_rate_previous: f.rate_previous ?? null,
  };
}

/** Errores de la base de datos del pago en moneda diferente, en lenguaje sencillo. */
export function foreignPaymentError(message: string): string | null {
  for (const code of ["account_amount_required", "reference_rate_required"]) {
    const i = message.indexOf(`${code}:`);
    if (i >= 0) return message.slice(i + code.length + 1).trim();
  }
  return null;
}
