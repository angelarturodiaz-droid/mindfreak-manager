import { describe, expect, it } from "vitest";
import { computeFx } from "@/features/currencies/fx";

const base = { functionalCurrency: "DOP", tolerance: 1 };

describe("Multimoneda V5 — pago/cobro en moneda diferente (casos aprobados)", () => {
  it("1. Factura DOP 97,000 desde cuenta USD con US$1,650 (ref 58.80)", () => {
    const r = computeFx({ ...base, kind: "PAGO", documentCurrency: "DOP", accountCurrency: "USD", applied: 97000, accountAmount: 1650, referenceRate: 58.8 });
    expect(r.effectiveRate).toBe(58.787879);
    expect(r.effectiveRateCurrency).toBe("USD");
    expect(r.functionalAmount).toBe(97020);
    expect(r.informativeDifference).toBe(20);
    expect(r.roundingDifference).toBe(0);
    expect(r.estimatedAccountAmount).toBe(1649.66);
  });
  it("3a/3b. Parciales: US$500 → RD$30,000 (ref 59) y US$1,150 → RD$70,000 (ref 59.50)", () => {
    const a = computeFx({ ...base, kind: "PAGO", documentCurrency: "DOP", accountCurrency: "USD", applied: 30000, accountAmount: 500, referenceRate: 59 });
    expect(a.effectiveRate).toBe(60);
    expect(a.informativeDifference).toBe(-500);
    const b = computeFx({ ...base, kind: "PAGO", documentCurrency: "DOP", accountCurrency: "USD", applied: 70000, accountAmount: 1150, referenceRate: 59.5 });
    expect(b.effectiveRate).toBe(60.869565);
    expect(b.informativeDifference).toBe(-1575);
  });
  it("4. Cobro DOP 60,000 con US$1,000 (ref 59.80) → diferencia +200 (se recibió menos)", () => {
    const r = computeFx({ ...base, kind: "COBRO", documentCurrency: "DOP", accountCurrency: "USD", applied: 60000, accountAmount: 1000, referenceRate: 59.8 });
    expect(r.effectiveRate).toBe(60);
    expect(r.informativeDifference).toBe(200);
  });
  it("5. Factura USD 1,000 pagada desde DOP 59,300 (ref USD 59.20)", () => {
    const r = computeFx({ ...base, kind: "PAGO", documentCurrency: "USD", accountCurrency: "DOP", applied: 1000, accountAmount: 59300, referenceRateDocument: 59.2 });
    expect(r.effectiveRate).toBe(59.3);
    expect(r.effectiveRateCurrency).toBe("USD");
    expect(r.informativeDifference).toBe(100);
  });
  it("6. Redondeo: US$1,649.67 por RD$97,000 → 0.60 dentro de la tolerancia", () => {
    const r = computeFx({ ...base, kind: "PAGO", documentCurrency: "DOP", accountCurrency: "USD", applied: 97000, accountAmount: 1649.67, referenceRate: 58.8 });
    expect(r.roundingDifference).toBe(0.6);
    expect(r.informativeDifference).toBe(0);
  });
  it("7. Misma moneda: sin conversión", () => {
    const r = computeFx({ ...base, kind: "PAGO", documentCurrency: "DOP", accountCurrency: "DOP", applied: 50000, accountAmount: 0 });
    expect(r.multi).toBe(false);
    expect(r.effectiveRate).toBeNull();
    expect(r.difference).toBe(0);
  });
  it("8. EUR 1,000 desde cuenta USD US$1,100 (ref USD 59, EUR 65)", () => {
    const r = computeFx({ ...base, kind: "PAGO", documentCurrency: "EUR", accountCurrency: "USD", applied: 1000, accountAmount: 1100, referenceRate: 59, referenceRateDocument: 65 });
    expect(r.effectiveRate).toBe(59.090909);
    expect(r.informativeDifference).toBe(-100);
  });
  it("falta la tasa de referencia → no calcula", () => {
    expect(computeFx({ ...base, kind: "PAGO", documentCurrency: "DOP", accountCurrency: "USD", applied: 97000, accountAmount: 1650 }).missingRate).toBe("ACCOUNT");
    expect(computeFx({ ...base, kind: "PAGO", documentCurrency: "USD", accountCurrency: "DOP", applied: 1000, accountAmount: 59300 }).missingRate).toBe("DOCUMENT");
  });
  it("tolerancia configurable: con 0.50 el 0.60 ya es diferencia informativa", () => {
    const r = computeFx({ ...base, tolerance: 0.5, kind: "PAGO", documentCurrency: "DOP", accountCurrency: "USD", applied: 97000, accountAmount: 1649.67, referenceRate: 58.8 });
    expect(r.informativeDifference).toBe(0.6);
  });

  it("Paso 3. Factura USD 1,000 cobrada en cuenta DOP con RD$58,500 (ref 58.80) → +300, entró menos", () => {
    const r = computeFx({ ...base, kind: "COBRO", documentCurrency: "USD", accountCurrency: "DOP", applied: 1000, accountAmount: 58500, referenceRateDocument: 58.8 });
    expect(r.effectiveRate).toBe(58.5);
    expect(r.effectiveRateCurrency).toBe("USD");
    expect(r.functionalAmount).toBe(58500);
    expect(r.informativeDifference).toBe(300);
    expect(r.estimatedAccountAmount).toBe(58800);
  });
  it("Paso 3. Cobro parcial USD 500 → RD$29,600 (ref 59) → −100, entró más", () => {
    const r = computeFx({ ...base, kind: "COBRO", documentCurrency: "USD", accountCurrency: "DOP", applied: 500, accountAmount: 29600, referenceRateDocument: 59 });
    expect(r.informativeDifference).toBe(-100);
  });
  it("Paso 3. Cobro con redondeo dentro de la tolerancia", () => {
    const r = computeFx({ ...base, kind: "COBRO", documentCurrency: "USD", accountCurrency: "DOP", applied: 1000, accountAmount: 58799.5, referenceRateDocument: 58.8 });
    expect(r.roundingDifference).toBe(0.5);
    expect(r.informativeDifference).toBe(0);
  });
});
