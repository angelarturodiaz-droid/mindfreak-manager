/**
 * Multimoneda operacional V5 — cálculo de un pago o cobro en moneda
 * diferente (claude/propuesta-multimoneda-pagos.md, sección 2).
 *
 * Es la MISMA fórmula que usa la base de datos (public.fx_settlement,
 * migración 076); aquí solo sirve para mostrar en vivo el bloque "Pago en
 * moneda diferente". Lo que se guarda lo calcula siempre el servidor.
 *
 * Convención única de tasas: 1 unidad de moneda no funcional = X unidades
 * de moneda funcional (la funcional vale 1).
 */

export type FxKind = "PAGO" | "COBRO";

export type FxInput = {
  kind: FxKind;
  /** Moneda del documento (gasto o factura). */
  documentCurrency: string;
  /** Moneda de la cuenta bancaria. */
  accountCurrency: string;
  /** Moneda funcional (companies.base_currency). */
  functionalCurrency: string;
  /** Monto aplicado al documento, en su moneda. */
  applied: number;
  /** Monto real del banco, en la moneda de la cuenta (sin comisión). */
  accountAmount: number;
  /** Tasa de referencia de la moneda de la cuenta (si no es la funcional). */
  referenceRate?: number | null;
  /** Tasa de referencia de la moneda del documento (si es extranjera y distinta a la de la cuenta). */
  referenceRateDocument?: number | null;
  /** Tolerancia de redondeo, en moneda funcional. */
  tolerance: number;
};

export type FxResult = {
  multi: boolean;
  /** Precio de la moneda no funcional de la operación, en moneda funcional. */
  effectiveRate: number | null;
  /** Moneda que describe la tasa efectiva (ej. USD en "1 USD = 58.787879 DOP"). */
  effectiveRateCurrency: string | null;
  /** Equivalente funcional del dinero del banco, a tasa de referencia. */
  functionalAmount: number;
  /** Equivalente funcional de lo aplicado, a tasa de referencia. */
  functionalApplied: number;
  /** Diferencia: positiva = desfavorable para la empresa. */
  difference: number;
  roundingDifference: number;
  informativeDifference: number;
  /** Lo que se esperaría que mueva el banco a tasa de referencia (moneda de la cuenta). */
  estimatedAccountAmount: number | null;
  /** Falta una tasa necesaria para el cálculo. */
  missingRate: "ACCOUNT" | "DOCUMENT" | null;
};

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const r6 = (n: number) => Math.round((n + Number.EPSILON) * 1e6) / 1e6;

export function needsDocumentRate(i: Pick<FxInput, "documentCurrency" | "accountCurrency" | "functionalCurrency">) {
  return i.documentCurrency !== i.functionalCurrency && i.documentCurrency !== i.accountCurrency;
}

export function needsAccountRate(i: Pick<FxInput, "documentCurrency" | "accountCurrency" | "functionalCurrency">) {
  return i.accountCurrency !== i.functionalCurrency && i.accountCurrency !== i.documentCurrency;
}

export function computeFx(i: FxInput): FxResult {
  const multi = i.documentCurrency !== i.accountCurrency;
  const bank = multi ? i.accountAmount : i.applied;
  const accRate =
    i.accountCurrency === i.functionalCurrency ? 1 : i.referenceRate && i.referenceRate > 0 ? i.referenceRate : null;
  const docRate =
    i.documentCurrency === i.functionalCurrency
      ? 1
      : i.documentCurrency === i.accountCurrency
        ? accRate
        : i.referenceRateDocument && i.referenceRateDocument > 0
          ? i.referenceRateDocument
          : null;

  const empty: FxResult = {
    multi,
    effectiveRate: null,
    effectiveRateCurrency: null,
    functionalAmount: 0,
    functionalApplied: 0,
    difference: 0,
    roundingDifference: 0,
    informativeDifference: 0,
    estimatedAccountAmount: null,
    missingRate: null,
  };
  if (!multi) {
    // Misma moneda: no hay conversión; el equivalente funcional usa la tasa
    // de referencia si es extranjera (solo informativo).
    const f = accRate ? r2(bank * accRate) : 0;
    return { ...empty, functionalAmount: f, functionalApplied: f };
  }
  if (accRate === null) return { ...empty, missingRate: "ACCOUNT" };
  if (docRate === null) return { ...empty, missingRate: "DOCUMENT" };

  const estimatedAccountAmount = r2((i.applied * docRate) / accRate);
  if (!(bank > 0) || !(i.applied > 0)) return { ...empty, estimatedAccountAmount };

  const effectiveRateCurrency = i.accountCurrency !== i.functionalCurrency ? i.accountCurrency : i.documentCurrency;
  const effectiveRate =
    i.accountCurrency !== i.functionalCurrency ? r6((i.applied * docRate) / bank) : r6(bank / i.applied);

  const functionalAmount = r2(bank * accRate);
  const functionalApplied = r2(i.applied * docRate);
  const difference = r2(i.kind === "PAGO" ? functionalAmount - functionalApplied : functionalApplied - functionalAmount);
  const isRounding = Math.abs(difference) <= i.tolerance;
  return {
    multi,
    effectiveRate,
    effectiveRateCurrency,
    functionalAmount,
    functionalApplied,
    difference,
    roundingDifference: isRounding ? difference : 0,
    informativeDifference: isRounding ? 0 : difference,
    estimatedAccountAmount,
    missingRate: null,
  };
}

/**
 * Transferencia entre una cuenta en moneda base y otra en moneda extranjera
 * (paso 4). Misma fórmula que public.create_bank_transfer (migración 078).
 * `amount` sale de la cuenta origen; `received` entra en la destino; `ref` =
 * tasa del día (1 extranjera = X base). Diferencia positiva = desfavorable.
 */
export function computeTransferFx(i: { fromIsBase: boolean; amount: number; received: number; ref: number }) {
  const estimated = i.ref > 0 && i.amount > 0 ? r2(i.fromIsBase ? i.amount / i.ref : i.amount * i.ref) : null;
  const effective =
    i.amount > 0 && i.received > 0 ? r6(i.fromIsBase ? i.amount / i.received : i.received / i.amount) : null;
  const difference =
    i.ref > 0 && i.amount > 0 && i.received > 0
      ? r2(i.fromIsBase ? i.amount - i.received * i.ref : i.amount * i.ref - i.received)
      : null;
  return { estimated, effective, difference };
}
