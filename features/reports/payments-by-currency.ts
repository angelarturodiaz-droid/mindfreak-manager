/**
 * Multimoneda V5 (paso 5): reporte operativo "Pagos y cobros por moneda".
 * Une cobros (customer_payments) y pagos a proveedores (supplier_payments)
 * en filas iguales y calcula los totales. Solo informa: la diferencia
 * informativa NO es ganancia ni pérdida contable.
 *
 * Registros anteriores a la migración 076/077 no tienen los datos de
 * conversión: se toman como "misma moneda" (la cuenta se movió por el
 * monto aplicado) y el equivalente funcional sale de la tasa del documento.
 */

export type PaymentDirection = "COBRO" | "PAGO";

/** Fila tal como llega de la base (cobro o pago). */
export type RawFxPayment = {
  id: string;
  payment_date: string;
  amount: number | string;
  currency: string;
  exchange_rate: number | string | null;
  account_currency: string | null;
  account_amount: number | string | null;
  bank_fee_amount: number | string | null;
  functional_currency: string | null;
  functional_amount: number | string | null;
  effective_rate: number | string | null;
  effective_rate_currency: string | null;
  reference_rate: number | string | null;
  reference_rate_document: number | string | null;
  rate_manual_override: boolean | null;
  rounding_difference: number | string | null;
  informative_difference: number | string | null;
};

export type PaymentFxRow = {
  id: string;
  direction: PaymentDirection;
  date: string;
  /** Factura o gasto. */
  documentLabel: string;
  documentHref: string | null;
  party: string;
  accountName: string;
  documentCurrency: string;
  applied: number;
  accountCurrency: string;
  bankAmount: number;
  fee: number;
  /** La cuenta estaba en otra moneda que el documento. */
  foreign: boolean;
  effectiveRate: number | null;
  effectiveRateCurrency: string | null;
  referenceRate: number | null;
  manualRate: boolean;
  rounding: number;
  informative: number;
  functionalAmount: number;
};

const n = (v: number | string | null | undefined) => (v === null || v === undefined || v === "" ? 0 : Number(v));
const r2 = (x: number) => Math.round((x + Number.EPSILON) * 100) / 100;

export function toPaymentFxRow(
  p: RawFxPayment,
  direction: PaymentDirection,
  meta: { documentLabel: string; documentHref: string | null; party: string; accountName: string },
  functionalCurrency: string,
): PaymentFxRow {
  const accountCurrency = p.account_currency || p.currency;
  const applied = n(p.amount);
  const bankAmount = p.account_amount !== null && p.account_amount !== undefined ? n(p.account_amount) : applied;
  const functionalAmount =
    p.functional_amount !== null && p.functional_amount !== undefined
      ? n(p.functional_amount)
      : accountCurrency === functionalCurrency
        ? bankAmount
        : r2(bankAmount * (n(p.exchange_rate) || 1));
  const fnCur = p.functional_currency || functionalCurrency;
  const referenceRate = accountCurrency !== fnCur ? p.reference_rate : p.reference_rate_document;
  return {
    id: p.id,
    direction,
    date: p.payment_date,
    ...meta,
    documentCurrency: p.currency,
    applied,
    accountCurrency,
    bankAmount,
    fee: n(p.bank_fee_amount),
    foreign: accountCurrency !== p.currency,
    effectiveRate: p.effective_rate !== null && p.effective_rate !== undefined ? n(p.effective_rate) : null,
    effectiveRateCurrency: p.effective_rate_currency,
    referenceRate: referenceRate !== null && referenceRate !== undefined ? n(referenceRate) : null,
    manualRate: Boolean(p.rate_manual_override),
    rounding: n(p.rounding_difference),
    informative: n(p.informative_difference),
    functionalAmount,
  };
}

export type PaymentsByCurrencySummary = {
  count: number;
  foreignCount: number;
  /** Por moneda de la cuenta: lo que entró (cobros), salió (pagos) y comisiones. */
  byAccountCurrency: { currency: string; cobrado: number; pagado: number; comisiones: number }[];
  /** En moneda funcional. Positiva = desfavorable. */
  informativeTotal: number;
  roundingTotal: number;
  cobradoFunctional: number;
  pagadoFunctional: number;
};

export function summarizePaymentsByCurrency(rows: PaymentFxRow[]): PaymentsByCurrencySummary {
  const map = new Map<string, { currency: string; cobrado: number; pagado: number; comisiones: number }>();
  let informativeTotal = 0;
  let roundingTotal = 0;
  let cobradoFunctional = 0;
  let pagadoFunctional = 0;
  for (const r of rows) {
    const e = map.get(r.accountCurrency) ?? { currency: r.accountCurrency, cobrado: 0, pagado: 0, comisiones: 0 };
    if (r.direction === "COBRO") {
      e.cobrado += r.bankAmount;
      cobradoFunctional += r.functionalAmount;
    } else {
      e.pagado += r.bankAmount;
      pagadoFunctional += r.functionalAmount;
    }
    e.comisiones += r.fee;
    map.set(r.accountCurrency, e);
    informativeTotal += r.informative;
    roundingTotal += r.rounding;
  }
  return {
    count: rows.length,
    foreignCount: rows.filter((r) => r.foreign).length,
    byAccountCurrency: [...map.values()]
      .map((e) => ({ ...e, cobrado: r2(e.cobrado), pagado: r2(e.pagado), comisiones: r2(e.comisiones) }))
      .sort((a, b) => a.currency.localeCompare(b.currency)),
    informativeTotal: r2(informativeTotal),
    roundingTotal: r2(roundingTotal),
    cobradoFunctional: r2(cobradoFunctional),
    pagadoFunctional: r2(pagadoFunctional),
  };
}
