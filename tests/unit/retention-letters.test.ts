import { describe, expect, it } from "vitest";
import { letterParagraph, pctLabel, retentionPercents } from "@/features/retention-letters/schema";

describe("carta de retención (4b)", () => {
  it("calcula 100 % del ITBIS y 0 % de ISR como en el ejemplo", () => {
    const p = retentionPercents({ subtotal: 4200, tax: 756, isrWithheld: 0, itbisWithheld: 756 });
    expect(pctLabel(p.itbisPct)).toBe("100 %");
    expect(pctLabel(p.isrPct)).toBe("0 %");
  });

  it("30 % de ITBIS y 10 % de ISR", () => {
    const p = retentionPercents({ subtotal: 10000, tax: 1800, isrWithheld: 1000, itbisWithheld: 540 });
    expect(pctLabel(p.itbisPct)).toBe("30 %");
    expect(pctLabel(p.isrPct)).toBe("10 %");
  });

  it("el párrafo nombra al proveedor, su RNC y los porcentajes", () => {
    const t = letterParagraph({ itbisPct: 100, isrPct: 2, supplier: { name: "Proveedor Ejemplo", tax_id: "1-01-00000-1" } });
    expect(t).toContain("retuvimos el 100 % del ITBIS facturado");
    expect(t).toContain("el 2 % del Impuesto sobre la Renta");
    expect(t).toContain("Proveedor Ejemplo, RNC/Cédula 1-01-00000-1");
  });

  it("sin ITBIS facturado no divide entre cero", () => {
    expect(retentionPercents({ subtotal: 0, tax: 0, isrWithheld: 0, itbisWithheld: 0 })).toEqual({ itbisPct: 0, isrPct: 0 });
  });
});
