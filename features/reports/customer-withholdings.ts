/**
 * Reporte "Retenciones de clientes" (migración 083): agrupaciones puras para
 * poder probarlas sin base de datos.
 */
export type WithholdingReportRow = {
  id: string;
  date: string;
  type: string;
  amount: number;
  currency: string;
  certificateAmount: number | null;
  certificateCurrency: string | null;
  certificateNumber: string | null;
  hasDocument: boolean;
  status: string;
  voidReason: string | null;
  invoiceId: string;
  invoiceNumber: string;
  clientId: string;
  clientName: string;
  paymentDate: string | null;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Totales por tipo y moneda, y por cliente y moneda (solo activas). */
export function summarizeWithholdings(rows: WithholdingReportRow[]) {
  const byType = new Map<string, { type: string; currency: string; total: number; count: number }>();
  const byClient = new Map<string, { client: string; currency: string; total: number; count: number }>();
  // Lo que dicen los certificados de la DGII (siempre en RD$).
  const certificates = new Map<string, number>();
  let missingCert = 0;
  for (const r of rows) {
    if (r.status !== "ACTIVE") continue;
    const kt = `${r.type}|${r.currency}`;
    const t = byType.get(kt) ?? { type: r.type, currency: r.currency, total: 0, count: 0 };
    t.total = r2(t.total + r.amount);
    t.count += 1;
    byType.set(kt, t);
    const kc = `${r.clientId}|${r.currency}`;
    const c = byClient.get(kc) ?? { client: r.clientName, currency: r.currency, total: 0, count: 0 };
    c.total = r2(c.total + r.amount);
    c.count += 1;
    byClient.set(kc, c);
    if (r.certificateAmount && r.certificateCurrency) {
      certificates.set(r.certificateCurrency, r2((certificates.get(r.certificateCurrency) ?? 0) + r.certificateAmount));
    }
    if (!r.certificateNumber && !r.hasDocument) missingCert += 1;
  }
  return {
    byType: [...byType.values()].sort((a, b) => a.type.localeCompare(b.type)),
    byClient: [...byClient.values()].sort((a, b) => b.total - a.total),
    certificates: [...certificates.entries()].map(([currency, total]) => ({ currency, total })),
    missingCert,
  };
}

/** Recibido en banco vs aplicado (por moneda de la factura). */
export function receivedVsApplied(
  payments: { currency: string; amount: number; withholding_total: number }[],
) {
  const map = new Map<string, { currency: string; received: number; withheld: number; applied: number }>();
  for (const p of payments) {
    const e = map.get(p.currency) ?? { currency: p.currency, received: 0, withheld: 0, applied: 0 };
    e.received = r2(e.received + Number(p.amount));
    e.withheld = r2(e.withheld + Number(p.withholding_total));
    e.applied = r2(e.received + e.withheld);
    map.set(p.currency, e);
  }
  return [...map.values()];
}
