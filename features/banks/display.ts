/**
 * Posición de una tarjeta de crédito a partir de su saldo único
 * (negativo = deuda, positivo = saldo a favor). Nunca se muestra una
 * "deuda negativa": el excedente de un pago es saldo a favor.
 *
 * Crédito disponible (reglas de la migración 063):
 *   límite − deuda                 (por defecto)
 *   límite − deuda + saldo a favor (si el banco permite que el saldo a favor
 *                                   aumente el poder de compra)
 */
export function cardPosition(
  balance: number,
  creditLimit: number | null | undefined,
  favorIncreasesLimit: boolean | null | undefined,
) {
  const debt = Math.max(0, -balance);
  const favor = Math.max(0, balance);
  const available =
    creditLimit == null ? null : Math.max(0, creditLimit - debt + (favorIncreasesLimit ? favor : 0));
  const usage = creditLimit ? Math.min(100, (debt / creditLimit) * 100) : null;
  return { debt, favor, available, usage };
}

export type CashSummary = {
  /** Total disponible (ahorro + corriente + sin tipo) en esa moneda. */
  total: number;
  savings: number;
  checking: number;
  /** Cuentas bancarias viejas sin tipo asignado. */
  other: number;
  count: number;
};

/**
 * Dinero disponible en bancos, en UNA moneda: suma de las cuentas bancarias
 * activas (ahorro y corriente). No incluye tarjetas de crédito (no es
 * dinero propio). Pesos y dólares se calculan por separado y nunca se
 * suman entre sí. Una cuenta corriente en sobregiro resta.
 */
export function availableCash(
  accounts: { type: string; is_active: boolean; currency: string; account_kind: string | null; current_balance: number }[],
  currency: string,
): CashSummary {
  const out: CashSummary = { total: 0, savings: 0, checking: 0, other: 0, count: 0 };
  for (const a of accounts) {
    if (a.type !== "BANK" || !a.is_active || a.currency !== currency) continue;
    const balance = Number(a.current_balance);
    out.total += balance;
    out.count += 1;
    if (a.account_kind === "SAVINGS") out.savings += balance;
    else if (a.account_kind === "CHECKING") out.checking += balance;
    else out.other += balance;
  }
  return out;
}
