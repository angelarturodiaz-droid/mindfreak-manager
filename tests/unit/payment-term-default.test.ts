import { describe, expect, it } from "vitest";
import { defaultPaymentTermId } from "@/features/payment-terms/default";

describe("Condición de pago por defecto (50/50)", () => {
  const terms = [
    { id: "contado", credit_days: 0, advance_percent: "100.00", balance_percent: "0.00", is_active: true },
    { id: "c30", credit_days: 30, advance_percent: "100.00", balance_percent: "0.00", is_active: true },
    { id: "mitad", credit_days: 0, advance_percent: "50.00", balance_percent: "50.00", is_active: true },
  ];
  it("elige la de 50 % anticipo y 50 % al final", () => expect(defaultPaymentTermId(terms)).toBe("mitad"));
  it("sin ella (o desactivada) queda «Sin especificar»", () => {
    expect(defaultPaymentTermId(terms.slice(0, 2))).toBe("");
    expect(defaultPaymentTermId([{ ...terms[2], is_active: false }])).toBe("");
  });
});
