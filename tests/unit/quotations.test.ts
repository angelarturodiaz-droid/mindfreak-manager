import { describe, it, expect } from "vitest";
import {
  calculateItemSubtotal,
  calculateItemEstimatedCost,
  calculateQuotationTotals,
} from "@/features/quotations/schema";

describe("calculateItemSubtotal", () => {
  it("calcula (cantidad × precio) − descuento + impuesto", () => {
    expect(
      calculateItemSubtotal({ quantity: 2, unit_price: 100, discount: 10, tax: 18 }),
    ).toBe(2 * 100 - 10 + 18);
  });

  it("nunca es negativo, aunque el descuento supere el subtotal", () => {
    expect(
      calculateItemSubtotal({ quantity: 1, unit_price: 10, discount: 100, tax: 0 }),
    ).toBe(0);
  });

  it("con cantidad/precio/descuento/impuesto en 0 da 0", () => {
    expect(
      calculateItemSubtotal({ quantity: 0, unit_price: 0, discount: 0, tax: 0 }),
    ).toBe(0);
  });
});

describe("calculateItemEstimatedCost", () => {
  it("multiplica cantidad × costo unitario estimado", () => {
    expect(calculateItemEstimatedCost({ quantity: 3, estimated_unit_cost: 50 })).toBe(150);
  });
});

describe("calculateQuotationTotals", () => {
  it("suma subtotal/descuento/impuesto/costo estimado de todas las líneas", () => {
    const totals = calculateQuotationTotals([
      { quantity: 1, unit_price: 1000, discount: 0, tax: 180, estimated_unit_cost: 400 },
      { quantity: 2, unit_price: 500, discount: 50, tax: 90, estimated_unit_cost: 200 },
    ]);
    // subtotal = 1000 + 1000 = 2000; discount = 50; tax = 270
    expect(totals.subtotal).toBe(2000);
    expect(totals.discount).toBe(50);
    expect(totals.tax).toBe(270);
    expect(totals.total).toBe(2000 - 50 + 270);
    expect(totals.estimated_cost).toBe(400 + 400); // 1×400 + 2×200
  });

  it("el margen estimado es 0 si el total es 0 (evita división por cero)", () => {
    const totals = calculateQuotationTotals([]);
    expect(totals.total).toBe(0);
    expect(totals.estimated_margin).toBe(0);
  });

  it("calcula el margen estimado correctamente cuando hay total", () => {
    // total 1000, costo estimado 600 -> margen = (1000-600)/1000*100 = 40%
    const totals = calculateQuotationTotals([
      { quantity: 1, unit_price: 1000, discount: 0, tax: 0, estimated_unit_cost: 600 },
    ]);
    expect(totals.estimated_margin).toBe(40);
  });
});
