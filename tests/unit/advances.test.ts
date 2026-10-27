import { describe, expect, it } from "vitest";
import {
  advanceAvailable,
  advanceErrorMessage,
  advanceReceiptSummary,
  advanceSchema,
  advanceStatus,
  canBeBeforeCutoff,
  parseTarget,
  suggestApplications,
} from "@/features/advances/schema";

describe("anticipos de clientes (V1-3)", () => {
  it("disponible = recibido − aplicado − devuelto, y su estado", () => {
    expect(advanceAvailable({ amount: 50000, applied_amount: 0, refunded_amount: 0 })).toBe(50000);
    expect(advanceStatus({ amount: 50000, applied_amount: 0, refunded_amount: 0 })).toBe("AVAILABLE");
    expect(advanceStatus({ amount: 50000, applied_amount: 20000, refunded_amount: 0 })).toBe("PARTIAL");
    expect(advanceStatus({ amount: "50000.00", applied_amount: "50000.00", refunded_amount: "0" })).toBe("APPLIED");
    expect(advanceStatus({ amount: 50000, applied_amount: 0, refunded_amount: 50000 })).toBe("REFUNDED");
    expect(advanceStatus({ amount: 50000, applied_amount: 30000, refunded_amount: 20000 })).toBe("USED");
  });

  it("sugiere aplicar del más viejo al más nuevo sin pasarse del balance (ejemplo boda Pérez)", () => {
    // Anticipos 50,000 y 30,000; factura de 118,000 → se aplican los dos completos.
    expect(suggestApplications([{ id: "a", available: 50000 }, { id: "b", available: 30000 }], 118000)).toEqual([
      { id: "a", amount: 50000 },
      { id: "b", amount: 30000 },
    ]);
    // Factura de 60,000 → el segundo solo cubre 10,000.
    expect(suggestApplications([{ id: "a", available: 50000 }, { id: "b", available: 30000 }], 60000)).toEqual([
      { id: "a", amount: 50000 },
      { id: "b", amount: 10000 },
    ]);
    expect(suggestApplications([{ id: "a", available: 100 }], 0)).toEqual([{ id: "a", amount: 0 }]);
  });

  it("recibo: total cotizado, recibido hasta hoy y cuánto resta", () => {
    expect(advanceReceiptSummary(118000, 50000)).toEqual({ totalQuoted: 118000, receivedToDate: 50000, paidInvoices: 0, remaining: 68000 });
    expect(advanceReceiptSummary(118000, 80000).remaining).toBe(38000);
    // Si ya se cobró una factura del proyecto, también rebaja lo que resta.
    expect(advanceReceiptSummary(118000, 50000, 18000).remaining).toBe(50000);
    expect(advanceReceiptSummary(null, 1000)).toEqual({ totalQuoted: null, receivedToDate: 1000, paidInvoices: 0, remaining: null });
    expect(advanceReceiptSummary(1000, 1500).remaining).toBe(0);
  });

  it("destino: proyecto, cotización o solo el cliente", () => {
    const id = "03484f38-aa66-4e91-b0e9-3c30e9ab344e";
    expect(parseTarget(`project:${id}`)).toEqual({ projectId: id, quotationId: null });
    expect(parseTarget(`quotation:${id}`)).toEqual({ projectId: null, quotationId: id });
    expect(parseTarget("client")).toEqual({ projectId: null, quotationId: null });
    expect(parseTarget("project:abc")).toBeNull();
    expect(parseTarget("otra:cosa")).toBeNull();
  });

  it("«Recibido antes del corte» solo antes del 1-ene-2027 y exige cuenta si no", () => {
    expect(canBeBeforeCutoff("2026-12-31")).toBe(true);
    expect(canBeBeforeCutoff("2027-01-01")).toBe(false);
    const base = {
      client_id: "03484f38-aa66-4e91-b0e9-3c30e9ab344e",
      target: "client",
      receipt_date: "2027-01-05",
      amount: "1000",
      currency: "DOP",
    };
    expect(advanceSchema.safeParse({ ...base, before_cutoff: true }).success).toBe(false);
    expect(advanceSchema.safeParse({ ...base, before_cutoff: false, bank_account_id: "" }).success).toBe(false);
    expect(advanceSchema.safeParse({ ...base, receipt_date: "2026-12-20", before_cutoff: true }).success).toBe(true);
  });

  it("errores de la base de datos en palabras sencillas", () => {
    expect(advanceErrorMessage("amount_exceeds_available: el anticipo solo tiene 10")).toMatch(/disponible/);
    expect(advanceErrorMessage("quotation_not_approved: x")).toMatch(/Apruébala/);
    expect(advanceErrorMessage("invalid_amount: el monto debe ser mayor a 0")).toBe("el monto debe ser mayor a 0");
  });
});
