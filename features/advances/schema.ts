import { z } from "zod";

/**
 * Anticipos de clientes (V1-3, migración 090). Ayudas puras (sin base de
 * datos) para las pantallas, el PDF y las pruebas.
 *
 * Un anticipo es dinero que el cliente entrega ANTES de que exista la
 * factura. Tiene su propio recibo (ANT-0001) sin impuestos y no es venta
 * hasta que se aplica a la factura final.
 */

export type AdvanceAmounts = {
  amount: number | string;
  applied_amount: number | string;
  refunded_amount: number | string;
};

export type AdvanceStatus = "AVAILABLE" | "PARTIAL" | "APPLIED" | "REFUNDED" | "USED";

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Lo que queda sin usar (ni aplicado a una factura ni devuelto). */
export function advanceAvailable(a: AdvanceAmounts): number {
  return Math.max(0, r2(Number(a.amount) - Number(a.applied_amount) - Number(a.refunded_amount)));
}

/** Estado en palabras sencillas, calculado de los montos. */
export function advanceStatus(a: AdvanceAmounts): AdvanceStatus {
  const applied = Number(a.applied_amount);
  const refunded = Number(a.refunded_amount);
  if (advanceAvailable(a) > 0.005) return applied > 0.005 || refunded > 0.005 ? "PARTIAL" : "AVAILABLE";
  if (refunded > 0.005 && applied <= 0.005) return "REFUNDED";
  if (applied > 0.005 && refunded <= 0.005) return "APPLIED";
  return "USED";
}

export const ADVANCE_STATUS_LABELS: Record<AdvanceStatus, string> = {
  AVAILABLE: "Disponible",
  PARTIAL: "Usado en parte",
  APPLIED: "Aplicado",
  REFUNDED: "Devuelto",
  USED: "Aplicado y devuelto",
};

export const ADVANCE_STATUS_TONES: Record<AdvanceStatus, "accent" | "warning" | "success" | "muted"> = {
  AVAILABLE: "accent",
  PARTIAL: "warning",
  APPLIED: "success",
  REFUNDED: "muted",
  USED: "muted",
};

export const ADVANCE_STATUS_INFO: Record<AdvanceStatus, string> = {
  AVAILABLE: "Todo el dinero está esperando la factura final. Cuando la emitas, ábrela y pulsa «Aplicar anticipos».",
  PARTIAL: "Una parte ya se aplicó a una factura o se devolvió; el resto sigue disponible.",
  APPLIED: "Todo el anticipo ya se descontó de la factura final.",
  REFUNDED: "Se le devolvió el dinero al cliente.",
  USED: "Una parte se aplicó a la factura y otra se devolvió. No queda nada disponible.",
};

export const MOVEMENT_KIND_LABELS: Record<string, string> = {
  APPLY: "Aplicado a factura",
  REFUND: "Devolución",
  TRANSFER: "Pasado a otro proyecto",
};

/** Fecha de corte del Go-Live (igual que public.mf_cutoff_date()). */
export const CUTOFF_DATE = "2027-01-01";
export const CUTOFF_LABEL = "1 de enero de 2027";

/** ¿Se puede marcar «Recibido antes del corte» para esta fecha? */
export function canBeBeforeCutoff(receiptDate: string): boolean {
  return Boolean(receiptDate) && receiptDate < CUTOFF_DATE;
}

/**
 * Reparte el balance de una factura entre los anticipos disponibles (el más
 * viejo primero), sin pasarse de lo disponible ni del balance.
 */
export function suggestApplications(
  advances: { id: string; available: number }[],
  balance: number,
): { id: string; amount: number }[] {
  let left = r2(Math.max(0, balance));
  return advances.map((a) => {
    const amount = r2(Math.min(Math.max(0, a.available), left));
    left = r2(left - amount);
    return { id: a.id, amount };
  });
}

/** Resumen del recibo: total cotizado, recibido hasta hoy y cuánto resta. */
export function advanceReceiptSummary(totalQuoted: number | null, receivedToDate: number, paidInvoices = 0) {
  if (totalQuoted === null || totalQuoted <= 0)
    return { totalQuoted: null, receivedToDate: r2(receivedToDate), paidInvoices: r2(paidInvoices), remaining: null };
  return {
    totalQuoted: r2(totalQuoted),
    receivedToDate: r2(receivedToDate),
    paidInvoices: r2(paidInvoices),
    remaining: r2(Math.max(0, totalQuoted - receivedToDate - paidInvoices)),
  };
}

/** A qué va ligado: «project:<id>», «quotation:<id>» o «client» (solo el cliente). */
export function parseTarget(value: string): { projectId: string | null; quotationId: string | null } | null {
  if (value === "client") return { projectId: null, quotationId: null };
  const [kind, id] = value.split(":");
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  if (kind === "project") return { projectId: id, quotationId: null };
  if (kind === "quotation") return { projectId: null, quotationId: id };
  return null;
}

const money = z.coerce.number({ message: "Escribe un monto válido." });

export const advanceSchema = z
  .object({
    client_id: z.string().uuid({ message: "Elige el cliente." }),
    target: z.string().min(1, { message: "Elige para qué es el anticipo." }),
    receipt_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Escribe la fecha en que se recibió." }),
    amount: money.positive({ message: "El monto del anticipo debe ser mayor a 0." }),
    currency: z.string().regex(/^[A-Z]{3}$/, { message: "Elige la moneda." }),
    method: z.string().min(1).default("TRANSFER"),
    reference: z.string().max(120).optional().default(""),
    notes: z.string().max(500).optional().default(""),
    before_cutoff: z.boolean().default(false),
    bank_account_id: z.string().optional().default(""),
  })
  .superRefine((v, ctx) => {
    if (v.before_cutoff && !canBeBeforeCutoff(v.receipt_date)) {
      ctx.addIssue({
        code: "custom",
        path: ["before_cutoff"],
        message: `«Recibido antes del corte» es solo para anticipos recibidos antes del ${CUTOFF_LABEL}.`,
      });
    }
    if (!v.before_cutoff && !v.bank_account_id) {
      ctx.addIssue({ code: "custom", path: ["bank_account_id"], message: "Elige la cuenta donde entró el dinero." });
    }
  });

export type AdvanceInput = z.infer<typeof advanceSchema>;

/** Errores de las funciones de la base de datos → mensaje sencillo. */
export function advanceErrorMessage(message: string): string {
  const known: [string, string][] = [
    ["quotation_not_approved", "La cotización todavía no está aprobada. Apruébala primero y luego registra el anticipo."],
    ["currency_mismatch_quotation", "El anticipo va en la misma moneda de la cotización."],
    ["currency_mismatch_invoice", "Este anticipo está en otra moneda que la factura: solo se aplica a facturas en su misma moneda."],
    ["project_cancelled", "Ese proyecto está cancelado: no recibe anticipos."],
    ["cutoff_date", `«Recibido antes del corte» es solo para anticipos recibidos antes del ${CUTOFF_LABEL}.`],
    ["bank_account_required", "Elige la cuenta donde entró (o de donde sale) el dinero."],
    ["invalid_account_type", "Elige una cuenta de banco (no una tarjeta de crédito)."],
    ["amount_exceeds_available", "El monto es mayor a lo que queda disponible en el anticipo."],
    ["amount_exceeds_balance", "El monto es mayor a lo que falta por cobrar de la factura."],
    ["advance_not_for_invoice", "Este anticipo es de otro proyecto o cotización. Pásalo primero a este proyecto desde el anticipo."],
    ["advance_partially_applied", "Una parte ya se aplicó a una factura: solo se puede pasar un anticipo que no se ha aplicado."],
    ["advance_used", "Este anticipo ya no tiene saldo disponible."],
    ["same_target", "El anticipo ya está en ese proyecto o cotización."],
    ["reason_required", "Escribe el motivo (al menos 3 letras)."],
    ["client_mismatch", "El cliente no coincide. Recarga la página e inténtalo de nuevo."],
    ["insufficient_privilege", "Tu rol no tiene permiso para esta acción. Pídeselo a un Administrador o a Finanzas."],
    ["account_amount_required", "Indica cuánto salió o entró realmente en la cuenta (está en otra moneda)."],
    ["invalid_status", "La factura no admite esta acción en su estado actual."],
  ];
  for (const [code, text] of known) if (message.includes(code)) return text;
  const i = message.indexOf("invalid_amount:");
  if (i >= 0) return message.slice(i + 15).trim();
  return message;
}
