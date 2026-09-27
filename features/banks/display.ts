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
