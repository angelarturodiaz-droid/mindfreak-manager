/**
 * Condición de pago que sale elegida en una cotización o factura nueva (15-nov-2026): la más común en Mindfreak,
 * «50% anticipo / 50% al finalizar» — la activa con 50 % de anticipo, 50 % al final y sin días de crédito. Si no
 * existe o se desactiva, queda «Sin especificar» como antes. Sin cambios en la base de datos.
 */
export function defaultPaymentTermId(
  terms: { id: string; credit_days: number; advance_percent?: number | string | null; balance_percent?: number | string | null; is_active?: boolean | null }[],
): string {
  const t = terms.find(
    (x) => x.is_active !== false && Number(x.advance_percent) === 50 && Number(x.balance_percent) === 50 && Number(x.credit_days) === 0,
  );
  return t?.id ?? "";
}
