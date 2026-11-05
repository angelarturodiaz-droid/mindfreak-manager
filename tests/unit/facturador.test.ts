import { describe, expect, it } from "vitest";
import { buildFacturadorData } from "@/features/invoices/facturador";

const base = {
  invoice: {
    number: "FAC-0050", issue_date: "2027-01-15", ncf_type: "31", payment_type_code: null, income_type: "01", ecf_comments: null,
    credit_days: 30, payment_terms_name: "Crédito 30 días", currency: "DOP", total: 0,
    commission_amount: 0, commission_tax_treatment: "GRAVADO", commission_tax_rate_percent: 18,
  },
  client: { name: "Empresa Ejemplo SRL", tax_id: "1-01-12345-6", foreign_id: null, phone: null, email: null, address: null, province_code: "010000", municipality_code: "010100" },
  items: [] as Parameters<typeof buildFacturadorData>[0]["items"],
};

describe("Datos para el Facturador DGII (5b)", () => {
  it("ordena y suma como el Facturador: gravado, ITBIS, exento y total", () => {
    const d = buildFacturadorData({
      ...base,
      invoice: { ...base.invoice, total: 118000 + 5000 },
      items: [
        { description: "Producción evento", unit_code: "43", item_kind: "SERVICIO", quantity: 1, unit_price: 105000, discount: 5000, tax: 18000, tax_treatment: "GRAVADO", tax_rate_percent: 18 },
        { description: "Capacitación", unit_code: "19", item_kind: "SERVICIO", quantity: 2, unit_price: 2500, discount: 0, tax: 0, tax_treatment: "EXENTO", tax_rate_percent: 0 },
      ],
    });
    const tot = Object.fromEntries(d.totals.map((r) => [r.n, r.copy]));
    expect(tot["27"]).toBe("100000.00");
    expect(tot["30"]).toBe("18000.00");
    expect(tot["35"]).toBe("5000.00");
    expect(tot["33"]).toBe("100000.00");
    expect(tot["39"]).toBe("123000.00");
    expect(d.totalMatches).toBe(true);
    expect(d.lines[0].value).toBe("100000.00");
    expect(d.lines[0].discount).toBe("5000.00");
    expect(d.lines[1].unit).toBe("Hora");
    expect(d.lines[1].itbis).toBe("Exento");
    const h = Object.fromEntries(d.header.map((r) => [r.n, r]));
    expect(h["3"].copy).toBe("2");
    expect(h["5"].value).toBe("30 días");
    expect(h["6"].copy).toBe("101123456");
    expect(h["13"].value).toBe("Distrito Nacional");
    expect(h["14"].value).toBe("Santo Domingo de Guzmán");
  });
  it("la comisión de agencia va como una línea más con su ITBIS", () => {
    const d = buildFacturadorData({
      ...base,
      invoice: { ...base.invoice, total: 11800 + 1180, commission_amount: 1000 },
      items: [{ description: "Montaje", unit_code: null, item_kind: null, quantity: 1, unit_price: 10000, discount: 0, tax: 1800, tax_treatment: "GRAVADO", tax_rate_percent: 18 }],
    });
    expect(d.lines).toHaveLength(2);
    expect(d.lines[1].isCommission).toBe(true);
    expect(d.lines[0].unit).toBe("Unidad");
    expect(d.lines[0].kind).toBe("Servicio");
    expect(d.totals.find((r) => r.n === "39")!.copy).toBe("12980.00");
    expect(d.totalMatches).toBe(true);
  });
  it("avisa si un tipo 31 no tiene RNC y si el total no cuadra", () => {
    const d = buildFacturadorData({
      ...base,
      client: { ...base.client, tax_id: null },
      invoice: { ...base.invoice, total: 999 },
      items: [{ description: "X", unit_code: "43", item_kind: "SERVICIO", quantity: 1, unit_price: 100, discount: 0, tax: 18, tax_treatment: "GRAVADO", tax_rate_percent: 18 }],
    });
    expect(d.checks[0].ok).toBe(false);
    expect(d.totalMatches).toBe(false);
  });
});

describe("buildFacturadorData · tipo de pago vs condición", () => {
  it("avisa si dice Contado con condición a crédito", async () => {
    const { buildFacturadorData } = await import("@/features/invoices/facturador");
    const d = buildFacturadorData({
      invoice: { number: "FAC-1", issue_date: "2026-11-04", ncf_type: "31", payment_type_code: "1", income_type: "01", ecf_comments: null, credit_days: 15, payment_terms_name: null, currency: "DOP", total: 0, commission_amount: 0, commission_tax_treatment: "GRAVADO", commission_tax_rate_percent: 0 },
      client: { name: "X", tax_id: "131234567", foreign_id: null, phone: null, email: null, address: null, province_code: null, municipality_code: null },
      items: [],
    });
    expect(d.checks.some((c) => !c.ok && c.text.includes("Crédito"))).toBe(true);
  });
});
