import { todayISO } from "@/lib/utils/dates";

/**
 * "Expirada" se calcula por la fecha de validez, no se guarda: nada cambia
 * el estado a EXPIRED al pasar `valid_until`. Una cotización está expirada
 * si sigue abierta (Enviada, Vista o En negociación) y su validez ya pasó
 * (zona horaria de la empresa), o si quedó guardada como EXPIRED.
 * Se puede aprobar o rechazar igual (el cliente puede aceptar tarde).
 */
export const OPEN_QUOTATION_STATUSES = ["SENT", "VIEWED", "NEGOTIATING"];

export function isQuotationExpired(
  q: { status: string; valid_until: string | null },
  today: string = todayISO(),
): boolean {
  if (q.status === "EXPIRED") return true;
  if (!OPEN_QUOTATION_STATUSES.includes(q.status)) return false;
  return Boolean(q.valid_until && q.valid_until < today);
}

/** Estado para mostrar y filtrar: EXPIRED si expiró, si no el guardado. */
export function effectiveQuotationStatus(
  q: { status: string; valid_until: string | null },
  today: string = todayISO(),
): string {
  return isQuotationExpired(q, today) ? "EXPIRED" : q.status;
}

/** Estados que se ofrecen como filtro ("Vista" no se puede detectar todavía). */
export const QUOTATION_FILTER_STATUSES = ["DRAFT", "SENT", "NEGOTIATING", "APPROVED", "REJECTED", "EXPIRED", "CANCELLED"];
