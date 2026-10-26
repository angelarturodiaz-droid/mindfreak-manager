import { describe, expect, it } from "vitest";
import {
  expenseNet,
  groupExpenses,
  groupSales,
  profit,
  quotationMarginPct,
  saleNet,
  splitInvoiceByTax,
  sumExpenses,
  sumSales,
} from "@/features/profitability/net-of-tax";

describe("rentabilidad sin ITBIS", () => {
  it("venta = total − ITBIS, convertida con la tasa congelada", () => {
    expect(saleNet({ total: 118, tax: 18 })).toBe(100);
    expect(saleNet({ total: "1416.00", tax: "216.00", exchange_rate: "58.8" })).toBeCloseTo(1200 * 58.8);
  });

  it("gasto = subtotal sin ITBIS; el total con ITBIS queda aparte", () => {
    expect(expenseNet({ subtotal: 1010, total: 1191.8 })).toBe(1010);
    const t = sumExpenses([
      { subtotal: 1010, total: 1191.8 },
      { subtotal: 100, total: 118, exchange_rate: 60 },
    ]);
    expect(t.net).toBe(1010 + 6000);
    expect(t.gross).toBeCloseTo(1191.8 + 7080);
  });

  it("utilidad y margen sobre la venta sin ITBIS (caso PROJ-0001)", () => {
    const ventas = sumSales([{ total: 3480, tax: 1080 }]);
    expect(ventas.net).toBe(2400);
    const r = profit(ventas.net - 0, 50);
    expect(r.utilidad).toBe(2350);
    expect(r.margen).toBeCloseTo(97.9, 1);
    expect(profit(0, 1010)).toEqual({ utilidad: -1010, margen: null });
  });

  it("dashboard de octubre: el margen ya no cuenta el ITBIS", () => {
    const r = profit(543026.34, 567925);
    expect(r.utilidad).toBeCloseTo(-24898.66, 2);
    expect(r.margen).toBeCloseTo(-4.6, 1);
  });

  it("margen estimado de la cotización (COT-0026, COT-0024, COT-0016)", () => {
    expect(quotationMarginPct({ total: 1878.56, tax: 286.56, estimated_cost: 995 })).toBeCloseTo(37.5, 1);
    expect(quotationMarginPct({ total: 118, tax: 18, estimated_cost: 100 })).toBe(0);
    expect(quotationMarginPct({ total: 125257.34, tax: 5378.24, estimated_cost: 16988 })).toBeCloseTo(85.8, 1);
    expect(quotationMarginPct({ total: 0, tax: 0, estimated_cost: 10 })).toBe(0);
  });

  it("agrupa por proyecto o cliente y salta los que no tienen llave", () => {
    const s = groupSales(
      [
        { p: "a", total: 118, tax: 18 },
        { p: "a", total: 50, tax: 0 },
        { p: null, total: 999, tax: 0 },
      ],
      (r) => r.p,
    );
    expect(s.get("a")).toEqual({ net: 150, gross: 168 });
    expect(s.size).toBe(1);
    const e = groupExpenses([{ p: "a", subtotal: 10, total: 11.8 }], (r) => r.p);
    expect(e.get("a")?.net).toBe(10);
  });
});

describe("ingresos por tipo de impuesto", () => {
  it("separa gravado y exento por línea; suman el total sin ITBIS", () => {
    const r = splitInvoiceByTax({
      total: 1180 + 500,
      tax: 180,
      lines: [
        { subtotal: 1180, tax: 180, tax_treatment: "GRAVADO" },
        { subtotal: 500, tax: 0, tax_treatment: "EXENTO" },
      ],
    });
    expect(r).toEqual({ gravado: 1000, exento: 500, totalSinItbis: 1500, itbis: 180, total: 1680 });
  });

  it("el cargo por servicio sigue su propio impuesto", () => {
    // Líneas exentas 1,000 + comisión 20 % gravada (200 + 36 de ITBIS).
    const r = splitInvoiceByTax({
      total: 1236,
      tax: 36,
      commission_amount: 200,
      commission_tax_treatment: "GRAVADO",
      lines: [{ subtotal: 1000, tax: 0, tax_treatment: "EXENTO" }],
    });
    expect(r.gravado).toBe(200);
    expect(r.exento).toBe(1000);
    const exenta = splitInvoiceByTax({
      total: 1200,
      tax: 0,
      commission_amount: 200,
      commission_tax_treatment: "EXENTO",
      lines: [{ subtotal: 1000, tax: 0, tax_treatment: "EXENTO" }],
    });
    expect(exenta.gravado).toBe(0);
    expect(exenta.exento).toBe(1200);
  });

  it("convierte a pesos y trata líneas viejas sin tratamiento según su ITBIS", () => {
    const r = splitInvoiceByTax({
      total: 118,
      tax: 18,
      exchange_rate: 60,
      lines: [{ subtotal: 118, tax: 18, tax_treatment: null }],
    });
    expect(r.gravado).toBe(6000);
    expect(r.exento).toBe(0);
    expect(r.itbis).toBe(1080);
  });
});
