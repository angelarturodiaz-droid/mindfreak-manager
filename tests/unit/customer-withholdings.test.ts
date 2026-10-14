import { describe, expect, it } from "vitest";
import {
  certificateToDocument,
  documentToCertificate,
  parseWithholdings,
  summarizeCobro,
  suggestedReceived,
  withholdingErrorMessage,
  withholdingsRpcParam,
} from "@/features/payments/withholdings";
import { receivedVsApplied, summarizeWithholdings, type WithholdingReportRow } from "@/features/reports/customer-withholdings";

describe("retenciones de clientes — cobro", () => {
  it("caso 1: banco 112,600 + ITBIS 5,400 salda 118,000", () => {
    const s = summarizeCobro({ balance: 118000, received: 112600, withholdings: [{ amount: 5400 }] });
    expect(s).toMatchObject({ withholdingTotal: 5400, applied: 118000, after: 0, exceeds: false });
  });

  it("caso 3: dos tipos en el mismo cobro", () => {
    const s = summarizeCobro({ balance: 118000, received: 112600, withholdings: [{ amount: 2000 }, { amount: 3400 }] });
    expect(s.withholdingTotal).toBe(5400);
    expect(s.after).toBe(0);
  });

  it("caso 5: más que el saldo se marca", () => {
    const s = summarizeCobro({ balance: 55000, received: 52000, withholdings: [{ amount: 5000 }] });
    expect(s.exceeds).toBe(true);
    expect(s.applied).toBe(57000);
  });

  it("caso 8: solo retención (recibido 0)", () => {
    const s = summarizeCobro({ balance: 5400, received: 0, withholdings: [{ amount: 5400 }] });
    expect(s).toMatchObject({ applied: 5400, after: 0, nothing: false });
  });

  it("recibido sugerido = saldo − retenciones", () => {
    expect(suggestedReceived(118000, 5400)).toBe(112600);
    expect(suggestedReceived(100, 150)).toBe(0);
  });

  it("factura en USD: certificado RD$3,186 a tasa 59 = US$54", () => {
    expect(certificateToDocument(3186, 59)).toBe(54);
    expect(documentToCertificate(54, 59)).toBe(3186);
    expect(certificateToDocument(0, 59)).toBe(0);
  });

  it("lee y valida el JSON del formulario", () => {
    const ok = parseWithholdings(JSON.stringify([{ type: "ITBIS", amount: 5400, certificate_number: "C-1" }]));
    expect(ok.success).toBe(true);
    expect(parseWithholdings(JSON.stringify([{ type: "IVA", amount: 1 }])).success).toBe(false);
    expect(parseWithholdings(JSON.stringify([{ type: "ISR", amount: 0 }])).success).toBe(false);
    expect(parseWithholdings("no-json").success).toBe(false);
    expect(parseWithholdings("").success).toBe(true);
  });

  it("parámetro para la base de datos", () => {
    expect(withholdingsRpcParam([])).toBeNull();
    const p = withholdingsRpcParam([{ type: "ISR", amount: 100.004, certificate_amount: 5880, certificate_number: "", date: "", notes: "" }]);
    expect(p).toEqual([{ type: "ISR", amount: 100, certificate_amount: 5880, certificate_number: null, date: null, notes: null }]);
  });

  it("traduce los errores de la base de datos", () => {
    expect(withholdingErrorMessage("itbis_withholding_exceeds_tax: x")).toMatch(/ITBIS retenido supera/);
    expect(withholdingErrorMessage("otra cosa")).toBeNull();
  });
});

describe("retenciones de clientes — reporte", () => {
  const base: Omit<WithholdingReportRow, "id" | "type" | "amount" | "status"> = {
    date: "2026-10-13",
    currency: "DOP",
    certificateAmount: null,
    certificateCurrency: null,
    certificateNumber: null,
    hasDocument: false,
    voidReason: null,
    invoiceId: "i1",
    invoiceNumber: "INV-1",
    clientId: "c1",
    clientName: "Cliente A",
    paymentDate: "2026-10-13",
  };
  it("totales por tipo y sin certificado (solo activas)", () => {
    const s = summarizeWithholdings([
      { ...base, id: "1", type: "ITBIS", amount: 5400, status: "ACTIVE", certificateAmount: 5400, certificateCurrency: "DOP" },
      { ...base, id: "2", type: "ISR", amount: 2000, status: "ACTIVE", certificateNumber: "C-9" },
      { ...base, id: "3", type: "ITBIS", amount: 999, status: "VOIDED" },
    ]);
    expect(s.byType).toEqual([
      { type: "ISR", currency: "DOP", total: 2000, count: 1 },
      { type: "ITBIS", currency: "DOP", total: 5400, count: 1 },
    ]);
    expect(s.missingCert).toBe(1);
    expect(s.certificates).toEqual([{ currency: "DOP", total: 5400 }]);
  });

  it("recibido en banco vs aplicado", () => {
    expect(
      receivedVsApplied([
        { currency: "DOP", amount: 112600, withholding_total: 5400 },
        { currency: "DOP", amount: 0, withholding_total: 349.38 },
      ]),
    ).toEqual([{ currency: "DOP", received: 112600, withheld: 5749.38, applied: 118349.38 }]);
  });
});
