import { todayISO } from "@/lib/utils/dates";

/**
 * "Vencida" se calcula por la fecha, no se guarda: ninguna parte del
 * sistema cambia el estado de una factura a OVERDUE al pasar su fecha de
 * vencimiento (los pagos la mueven a PARTIALLY_PAID / PAID y perderían esa
 * marca). Una factura está vencida si está abierta (Emitida, Pago parcial
 * o un OVERDUE heredado), tiene balance y su fecha de vencimiento ya pasó
 * (zona horaria de la empresa). Los borradores no cuentan.
 */
export const OPEN_INVOICE_STATUSES = ["ISSUED", "PARTIALLY_PAID", "OVERDUE"];

export function isInvoiceOverdue(
  inv: { status: string; balance: number | string | null; due_date: string | null },
  today: string = todayISO(),
): boolean {
  if (!OPEN_INVOICE_STATUSES.includes(inv.status)) return false;
  if (Number(inv.balance ?? 0) <= 0) return false;
  if (inv.status === "OVERDUE") return true;
  return Boolean(inv.due_date && inv.due_date < today);
}

/** Estado para mostrar y filtrar: OVERDUE si está vencida, si no el guardado. */
export function effectiveInvoiceStatus(
  inv: { status: string; balance: number | string | null; due_date: string | null },
  today: string = todayISO(),
): string {
  return isInvoiceOverdue(inv, today) ? "OVERDUE" : inv.status;
}
