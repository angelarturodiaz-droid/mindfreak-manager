/** Monto con moneda (ej. RD$1,250.00 / US$50.00), formato dominicano. */
export function formatMoney(amount: number, currency = "DOP"): string {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency }).format(amount);
}
