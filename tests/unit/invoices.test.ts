import { describe, it, expect } from "vitest";
import {
  calculateInvoiceItemSubtotal,
  calculateInvoiceTotals,
} from "@/features/invoices/schema";

describe("calculateInvoiceItemSubtotal", () => {
  it("calcula (cantidad × precio) − descuento + impuesto", () => {
    expect(
      calculateInvoiceItemSubtotal({ quantity: 3, unit_price: 200, discount: 20, tax: 90 }),
    ).toBe(3 * 200 - 20 + 90);
  });

  it("nunca es negativo", () => {
    expect(
      calculateInvoiceItemSubtotal({ quantity: 1, unit_price: 5, discount: 50, tax: 0 }),
    ).toBe(0);
  });
});

describe("calculateInvoiceTotals", () => {
  it("agrega correctamente varias líneas", () => {
    const totals = calculateInvoiceTotals([
      { quantity: 1, unit_price: 500, discount: 0, tax: 90 },
      { quantity: 1, unit_price: 300, discount: 30, tax: 48.6 },
    ]);
    expect(totals.subtotal).toBe(800);
    expect(totals.discount).toBe(30);
    expect(totals.tax).toBeCloseTo(138.6);
    expect(totals.total).toBeCloseTo(800 - 30 + 138.6);
  });

  it("sin líneas, todos los totales son 0", () => {
    const totals = calculateInvoiceTotals([]);
    expect(totals).toEqual({ subtotal: 0, commission_amount: 0, discount: 0, tax: 0, total: 0 });
  });
});
