import { describe, it, expect } from "vitest";
import { calculateExpenseTotals } from "@/features/expenses/schema";

describe("calculateExpenseTotals", () => {
  it("calcula el impuesto como % del subtotal (ej. ITBIS 18%)", () => {
    const { tax, total } = calculateExpenseTotals({ subtotal: 1000, tax_percent: 18 });
    expect(tax).toBe(180);
    expect(total).toBe(1180);
  });

  it("con 0% de impuesto, el total es igual al subtotal", () => {
    const { tax, total } = calculateExpenseTotals({ subtotal: 500, tax_percent: 0 });
    expect(tax).toBe(0);
    expect(total).toBe(500);
  });

  it("redondea el impuesto a 2 decimales", () => {
    const { tax } = calculateExpenseTotals({ subtotal: 33.33, tax_percent: 18 });
    // 33.33 * 0.18 = 5.9994 -> redondeado a 6.00
    expect(tax).toBe(6);
  });

  it("nunca calcula impuesto sobre un subtotal negativo", () => {
    const { tax, total } = calculateExpenseTotals({ subtotal: -100, tax_percent: 18 });
    expect(tax).toBe(0);
    expect(total).toBe(-100); // el total en sí no se fuerza a 0, solo el impuesto
  });
});
