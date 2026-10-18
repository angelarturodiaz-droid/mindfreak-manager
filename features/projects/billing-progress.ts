/**
 * Cotizado vs. facturado de un proyecto (aviso pedido el 18-oct).
 *
 * Un proyecto puede tener varias facturas (anticipo, balance, adicionales).
 * Esto compara lo que el cliente aprobó (cotizaciones APROBADAS del proyecto)
 * con lo ya facturado (facturas emitidas, sin borradores ni canceladas) y,
 * aparte, cuánto sumarían los borradores si se emiten. Todo en la moneda base
 * con la tasa congelada de cada documento. Solo informa: no bloquea nada.
 */

/** Diferencias menores a esto se toman como "cuadra" (redondeos). */
export const BILLING_TOLERANCE = 1;

export type BillingState =
  /** No hay cotización aprobada con qué comparar. */
  | "none"
  /** Falta por facturar. */
  | "pending"
  /** Facturado = cotizado. */
  | "complete"
  /** Se facturó más de lo cotizado. */
  | "over";

export type BillingProgress = {
  state: BillingState;
  cotizado: number;
  facturado: number;
  borradores: number;
  /** cotizado − facturado (negativo si se pasó). */
  restante: number;
  /** facturado / cotizado × 100, o null sin cotizado. */
  pct: number | null;
  /** Si al emitir los borradores se pasaría de lo cotizado. */
  borradoresExceden: boolean;
  /** Cuánto se pasaría con los borradores (0 si no). */
  excesoConBorradores: number;
};

export function billingProgress(input: {
  cotizado: number;
  facturado: number;
  borradores?: number;
}): BillingProgress {
  const cotizado = Math.max(0, input.cotizado || 0);
  const facturado = Math.max(0, input.facturado || 0);
  const borradores = Math.max(0, input.borradores || 0);
  const restante = cotizado - facturado;

  let state: BillingState;
  if (cotizado <= 0) state = "none";
  else if (Math.abs(restante) < BILLING_TOLERANCE) state = "complete";
  else if (restante > 0) state = "pending";
  else state = "over";

  const exceso = facturado + borradores - cotizado;
  const borradoresExceden = cotizado > 0 && borradores > 0 && exceso >= BILLING_TOLERANCE;

  return {
    state,
    cotizado,
    facturado,
    borradores,
    restante,
    pct: cotizado > 0 ? (facturado / cotizado) * 100 : null,
    borradoresExceden,
    excesoConBorradores: borradoresExceden ? exceso : 0,
  };
}
