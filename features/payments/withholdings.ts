import { z } from "zod";

/**
 * Retenciones que hace el cliente al pagar una factura (migración 083).
 * La retención rebaja el saldo de la factura, pero NO entra al banco: el
 * cliente la paga a la DGII y entrega un certificado.
 *
 * Moneda: la retención se guarda en la moneda de la FACTURA (es lo que
 * rebaja su saldo). Si la factura es en otra moneda (ej. USD), el
 * certificado de la DGII viene en pesos: se pide ese monto y se convierte
 * con la tasa de la factura (editable).
 */

export const WITHHOLDING_TYPES = ["ITBIS", "ISR", "OTRO"] as const;
export type WithholdingType = (typeof WITHHOLDING_TYPES)[number];
export const WITHHOLDING_TYPE_LABELS: Record<WithholdingType, string> = {
  ITBIS: "ITBIS",
  ISR: "ISR",
  OTRO: "Otra",
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Monto del certificado (RD$) → moneda de la factura con su tasa. */
export function certificateToDocument(certificateAmount: number, rate: number): number {
  if (!(certificateAmount > 0) || !(rate > 0)) return 0;
  return round2(certificateAmount / rate);
}

/** Moneda de la factura → RD$ con su tasa (sugerencia del certificado). */
export function documentToCertificate(amount: number, rate: number): number {
  if (!(amount > 0) || !(rate > 0)) return 0;
  return round2(amount * rate);
}

/** Resumen en vivo del cobro: recibido + retenciones = aplicado. */
export function summarizeCobro({
  balance,
  received,
  withholdings,
}: {
  balance: number;
  received: number;
  withholdings: { amount: number }[];
}) {
  const withholdingTotal = round2(withholdings.reduce((a, w) => a + (w.amount > 0 ? w.amount : 0), 0));
  const applied = round2((received > 0 ? received : 0) + withholdingTotal);
  const after = round2(balance - applied);
  return {
    withholdingTotal,
    applied,
    after: after < 0 ? 0 : after,
    exceeds: applied > balance + 0.005,
    nothing: applied <= 0,
  };
}

/** "Recibido en banco" sugerido mientras el usuario no lo escriba a mano. */
export function suggestedReceived(balance: number, withholdingTotal: number): number {
  return Math.max(0, round2(balance - withholdingTotal));
}

const optionalMoney = z.preprocess(
  (v) => (v === "" || v === null || v === undefined || Number(v) === 0 ? undefined : v),
  z.coerce.number().positive("El monto del certificado debe ser mayor a 0.").optional(),
);

export const withholdingInputSchema = z.object({
  type: z.enum(WITHHOLDING_TYPES, { message: "Elige el tipo de retención (ITBIS, ISR u Otra)." }),
  amount: z.coerce.number().positive("Cada retención debe tener un monto mayor a 0."),
  certificate_amount: optionalMoney,
  certificate_number: z.string().trim().max(60).optional().or(z.literal("")),
  date: z.string().optional().or(z.literal("")),
  notes: z.string().trim().max(300).optional().or(z.literal("")),
});
export type WithholdingInput = z.infer<typeof withholdingInputSchema>;

export const withholdingsSchema = z.array(withholdingInputSchema).max(10, "Máximo 10 retenciones por cobro.");

/** Lee el JSON del campo oculto `withholdings` del formulario. */
export function parseWithholdings(raw: string | null | undefined) {
  if (!raw) return withholdingsSchema.safeParse([]);
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    value = null;
  }
  return withholdingsSchema.safeParse(value);
}

/** Parámetro p_withholdings de register_customer_payment. */
export function withholdingsRpcParam(list: WithholdingInput[]) {
  if (list.length === 0) return null;
  return list.map((w) => ({
    type: w.type,
    amount: round2(w.amount),
    certificate_amount: w.certificate_amount ? round2(w.certificate_amount) : null,
    certificate_number: w.certificate_number || null,
    date: w.date || null,
    notes: w.notes || null,
  }));
}

/** Mensaje claro para los errores nuevos de la base de datos (o null). */
export function withholdingErrorMessage(message: string): string | null {
  if (message.includes("itbis_withholding_exceeds_tax")) {
    return "El ITBIS retenido supera el ITBIS de la factura. Revisa el monto de la retención.";
  }
  if (message.includes("isr_withholding_exceeds_base")) {
    return "El ISR retenido supera el monto de la factura sin ITBIS. Revisa el monto de la retención.";
  }
  if (message.includes("invalid_withholding")) {
    const i = message.indexOf("invalid_withholding:");
    return message.slice(i + 20).trim();
  }
  return null;
}
