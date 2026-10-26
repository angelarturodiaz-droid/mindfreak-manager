/**
 * Rentabilidad sin ITBIS (V1-1, decidido con el contador el 22-oct-2026).
 *
 * Una sola cuenta para Proyecto, Cotización, Reportes, Comparaciones y
 * Dashboard. Funciones puras (sin base de datos) para poder probarlas.
 *
 * - Venta  = total del documento − ITBIS (incluye el cargo por servicio de
 *            agencia y ya resta el descuento). El ITBIS cobrado es de la DGII.
 * - Gasto  = subtotal (sin ITBIS), sin importar el comprobante. El gasto se
 *            sigue registrando y pagando con su ITBIS: esto es solo para la
 *            rentabilidad. (El ITBIS no recuperable queda para la V2.)
 * - Todo se convierte a la moneda base con la tasa congelada de cada registro.
 *
 * No toca nada fiscal: retenciones, net_payable, fiscal_snapshot y los
 * totales de cada documento quedan igual.
 */

type Num = number | string | null | undefined;

const n = (v: Num): number => {
  const x = typeof v === "string" ? Number(v) : v ?? 0;
  return Number.isFinite(x) ? (x as number) : 0;
};
const rate = (v: Num): number => (v === null || v === undefined || v === "" ? 1 : n(v));

/** Factura o cotización: lo mínimo para separar venta e ITBIS. */
export type SaleDoc = { total: Num; tax: Num; exchange_rate?: Num };
/** Gasto: subtotal (sin ITBIS) y total (con ITBIS). */
export type ExpenseDoc = { subtotal: Num; total: Num; exchange_rate?: Num };

/** Venta sin ITBIS, en moneda base. */
export function saleNet(doc: SaleDoc): number {
  return (n(doc.total) - n(doc.tax)) * rate(doc.exchange_rate);
}
/** Total del documento con ITBIS, en moneda base. */
export function saleGross(doc: SaleDoc): number {
  return n(doc.total) * rate(doc.exchange_rate);
}
/** Costo del gasto sin ITBIS, en moneda base. */
export function expenseNet(doc: ExpenseDoc): number {
  return n(doc.subtotal) * rate(doc.exchange_rate);
}
/** Total del gasto con ITBIS (lo que se paga), en moneda base. */
export function expenseGross(doc: ExpenseDoc): number {
  return n(doc.total) * rate(doc.exchange_rate);
}

export type Totals = { net: number; gross: number };

export function sumSales(rows: readonly SaleDoc[] | null | undefined): Totals {
  let net = 0;
  let gross = 0;
  for (const r of rows ?? []) {
    net += saleNet(r);
    gross += saleGross(r);
  }
  return { net, gross };
}

export function sumExpenses(rows: readonly ExpenseDoc[] | null | undefined): Totals {
  let net = 0;
  let gross = 0;
  for (const r of rows ?? []) {
    net += expenseNet(r);
    gross += expenseGross(r);
  }
  return { net, gross };
}

/** Margen en % sobre la venta sin ITBIS; null si no hay venta. */
export function marginPct(utilidad: number, ventaNeta: number): number | null {
  return ventaNeta > 0 ? (utilidad / ventaNeta) * 100 : null;
}

/** Utilidad = venta sin ITBIS − costo sin ITBIS, con su margen. */
export function profit(ventaNeta: number, costoNeto: number) {
  const utilidad = ventaNeta - costoNeto;
  return { utilidad, margen: marginPct(utilidad, ventaNeta) };
}

/**
 * Margen estimado de una cotización: (venta sin ITBIS − costo estimado) ÷
 * venta sin ITBIS. Se calcula al mostrarla, así las cotizaciones viejas
 * (que guardaron el margen sobre el total con ITBIS) salen bien sin tocar
 * lo guardado. Sin venta → 0 (como antes).
 */
export function quotationMarginPct(q: { total: Num; tax: Num; estimated_cost: Num }): number {
  const venta = n(q.total) - n(q.tax);
  return venta > 0 ? ((venta - n(q.estimated_cost)) / venta) * 100 : 0;
}

/** Agrupa por una llave (proyecto, cliente…) y suma venta neta y bruta. */
export function groupSales<T extends SaleDoc>(rows: readonly T[] | null | undefined, key: (r: T) => string | null | undefined) {
  const map = new Map<string, Totals>();
  for (const r of rows ?? []) {
    const k = key(r);
    if (!k) continue;
    const cur = map.get(k) ?? { net: 0, gross: 0 };
    cur.net += saleNet(r);
    cur.gross += saleGross(r);
    map.set(k, cur);
  }
  return map;
}

/** Agrupa gastos por una llave y suma costo neto y bruto. */
export function groupExpenses<T extends ExpenseDoc>(rows: readonly T[] | null | undefined, key: (r: T) => string | null | undefined) {
  const map = new Map<string, Totals>();
  for (const r of rows ?? []) {
    const k = key(r);
    if (!k) continue;
    const cur = map.get(k) ?? { net: 0, gross: 0 };
    cur.net += expenseNet(r);
    cur.gross += expenseGross(r);
    map.set(k, cur);
  }
  return map;
}

// ---- Ingresos por tipo de impuesto ----

export type TaxLine = { subtotal: Num; tax: Num; tax_treatment?: string | null };
export type InvoiceForTaxSplit = SaleDoc & {
  commission_amount?: Num;
  commission_tax_treatment?: string | null;
  lines: readonly TaxLine[];
};

/**
 * Separa la venta sin ITBIS de una factura en gravado y exento (exento
 * incluye «no sujeto»). Cada línea según su impuesto (el subtotal de la
 * línea ya trae el ITBIS, así que su base es subtotal − ITBIS); el cargo por
 * servicio (comisión de agencia) según el suyo. El exento es lo que resta,
 * así gravado + exento = total − ITBIS siempre. En moneda base.
 */
export function splitInvoiceByTax(inv: InvoiceForTaxSplit) {
  const fx = rate(inv.exchange_rate);
  let gravadoDoc = 0;
  for (const l of inv.lines) {
    // Sin tratamiento guardado (líneas viejas): gravada si lleva ITBIS.
    const gravada = l.tax_treatment ? l.tax_treatment === "GRAVADO" : n(l.tax) > 0;
    if (gravada) gravadoDoc += n(l.subtotal) - n(l.tax);
  }
  if ((inv.commission_tax_treatment ?? "") === "GRAVADO") gravadoDoc += n(inv.commission_amount);
  const netDoc = n(inv.total) - n(inv.tax);
  gravadoDoc = Math.min(Math.max(gravadoDoc, 0), Math.max(netDoc, 0));
  const exentoDoc = netDoc - gravadoDoc;
  return {
    gravado: gravadoDoc * fx,
    exento: exentoDoc * fx,
    totalSinItbis: netDoc * fx,
    itbis: n(inv.tax) * fx,
    total: n(inv.total) * fx,
  };
}
