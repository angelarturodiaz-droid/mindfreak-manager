import { describe, expect, it } from "vitest";
import { summarizePaymentsByCurrency, toPaymentFxRow, type RawFxPayment } from "@/features/reports/payments-by-currency";
import { fxSectionRows } from "@/lib/pdf/fx-section";

const base: RawFxPayment = {
  id: "1",
  payment_date: "2026-10-05",
  amount: 0,
  currency: "DOP",
  exchange_rate: 1,
  account_currency: null,
  account_amount: null,
  bank_fee_amount: null,
  functional_currency: null,
  functional_amount: null,
  effective_rate: null,
  effective_rate_currency: null,
  reference_rate: null,
  reference_rate_document: null,
  rate_manual_override: false,
  rounding_difference: 0,
  informative_difference: 0,
};
const meta = { documentLabel: "Doc", documentHref: null, party: "X", accountName: "Cuenta" };

describe("Multimoneda V5 — paso 5: reporte por moneda", () => {
  it("pago DOP 97,000 desde USD 1,650 + comisión 5", () => {
    const r = toPaymentFxRow(
      { ...base, amount: 97000, account_currency: "USD", account_amount: 1650, bank_fee_amount: 5, functional_currency: "DOP", functional_amount: 97020, effective_rate: 58.787879, effective_rate_currency: "USD", reference_rate: 58.8, informative_difference: 20 },
      "PAGO", meta, "DOP");
    expect(r.foreign).toBe(true);
    expect(r.bankAmount).toBe(1650);
    expect(r.fee).toBe(5);
    expect(r.referenceRate).toBe(58.8);
    expect(r.functionalAmount).toBe(97020);
  });
  it("cobro USD 1,000 en cuenta DOP: la referencia es la del documento", () => {
    const r = toPaymentFxRow(
      { ...base, amount: 1000, currency: "USD", exchange_rate: 58.8, account_currency: "DOP", account_amount: 58500, functional_currency: "DOP", functional_amount: 58500, effective_rate: 58.5, effective_rate_currency: "USD", reference_rate_document: 58.8, informative_difference: 300 },
      "COBRO", meta, "DOP");
    expect(r.referenceRate).toBe(58.8);
    expect(r.accountCurrency).toBe("DOP");
  });
  it("registro anterior (sin datos de conversión) = misma moneda; equivalente por la tasa del documento", () => {
    const r = toPaymentFxRow({ ...base, amount: 100, currency: "USD", exchange_rate: 59 }, "COBRO", meta, "DOP");
    expect(r.foreign).toBe(false);
    expect(r.accountCurrency).toBe("USD");
    expect(r.bankAmount).toBe(100);
    expect(r.functionalAmount).toBe(5900);
  });
  it("totales por moneda de la cuenta y diferencias", () => {
    const rows = [
      toPaymentFxRow({ ...base, amount: 97000, account_currency: "USD", account_amount: 1650, bank_fee_amount: 5, functional_amount: 97020, informative_difference: 20 }, "PAGO", meta, "DOP"),
      toPaymentFxRow({ ...base, amount: 1000, currency: "USD", account_currency: "DOP", account_amount: 58500, bank_fee_amount: 150, functional_amount: 58500, informative_difference: 300 }, "COBRO", meta, "DOP"),
      toPaymentFxRow({ ...base, amount: 1000, currency: "USD", account_currency: "DOP", account_amount: 58799.5, functional_amount: 58799.5, rounding_difference: 0.5 }, "COBRO", meta, "DOP"),
      toPaymentFxRow({ ...base, amount: 4000 }, "COBRO", meta, "DOP"),
    ];
    const s = summarizePaymentsByCurrency(rows);
    expect(s.count).toBe(4);
    expect(s.foreignCount).toBe(3);
    expect(s.byAccountCurrency).toEqual([
      { currency: "DOP", cobrado: 121299.5, pagado: 0, comisiones: 150 },
      { currency: "USD", cobrado: 0, pagado: 1650, comisiones: 5 },
    ]);
    expect(s.informativeTotal).toBe(320);
    expect(s.roundingTotal).toBe(0.5);
  });
});

describe("Multimoneda V5 — paso 5: recibos PDF", () => {
  it("misma moneda sin comisión: el recibo no cambia", () => {
    expect(fxSectionRows("COBRO", "a la factura", "DOP", 4000, { account_currency: "DOP", account_amount: 4000 })).toEqual([]);
    expect(fxSectionRows("PAGO", "al gasto", "DOP", 100, {})).toEqual([]);
  });
  it("cobro en otra moneda con comisión muestra los dos montos, tasas y diferencia", () => {
    const rows = fxSectionRows("COBRO", "a la factura", "USD", 1000, {
      account_currency: "DOP", account_amount: 58500, bank_fee_amount: 150, effective_rate: 58.5,
      effective_rate_currency: "USD", reference_rate_document: 58.8, informative_difference: 300, functional_currency: "DOP",
    });
    const labels = rows.map((r) => r.label);
    expect(labels).toContain("Aplicado a la factura");
    expect(labels).toContain("Entró a la cuenta");
    expect(labels).toContain("Neto en la cuenta");
    expect(labels).toContain("Tasa de referencia del día");
    expect(labels).toContain("Diferencia informativa (no contable)");
    expect(rows.find((r) => r.label === "Tasa efectiva")?.value).toBe("1 USD = 58.50 DOP");
  });
  it("pago desde cuenta USD: débito total y referencia de la cuenta", () => {
    const rows = fxSectionRows("PAGO", "al gasto", "DOP", 97000, {
      account_currency: "USD", account_amount: 1650, bank_fee_amount: 5, effective_rate: 58.787879,
      effective_rate_currency: "USD", reference_rate: 58.8, informative_difference: 20, functional_currency: "DOP",
    });
    expect(rows.find((r) => r.label === "Salió de la cuenta")).toBeTruthy();
    expect(rows.find((r) => r.label === "Débito total")?.value).toContain("1,655.00");
    expect(rows.find((r) => r.label === "Tasa de referencia del día")?.value).toBe("1 USD = 58.80 DOP");
  });
});
