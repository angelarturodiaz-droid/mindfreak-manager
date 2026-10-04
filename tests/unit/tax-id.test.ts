import { describe, it, expect } from "vitest";
import { analyzeTaxId, formatTaxId, isValidCedula, isValidRnc, normalizeTaxId } from "@/lib/fiscal/tax-id";

describe("RNC / Cédula", () => {
  it("normaliza guiones y espacios", () => {
    expect(normalizeTaxId(" 1-01-01234-5 ")).toBe("101012345");
    expect(normalizeTaxId("001 1234567 8")).toBe("00112345678");
  });

  it("9 dígitos = RNC y sugiere Persona Jurídica (no decide condición fiscal)", () => {
    const a = analyzeTaxId("101-01234-5");
    expect(a.kind).toBe("RNC");
    expect(a.suggestedSupplierKind).toBe("PERSONA_JURIDICA");
    expect(a.message).toContain("Parece ser un RNC");
  });

  it("11 dígitos = Cédula y sugiere Persona Física", () => {
    const a = analyzeTaxId("001-1234567-8");
    expect(a.kind).toBe("CEDULA");
    expect(a.suggestedSupplierKind).toBe("PERSONA_FISICA");
    expect(a.message).toContain("Parece ser una Cédula");
  });

  it("longitud inválida avisa sin sugerir tipo", () => {
    const a = analyzeTaxId("12345678");
    expect(a.kind).toBe("UNKNOWN");
    expect(a.suggestedSupplierKind).toBeNull();
    expect(a.tone).toBe("warning");
  });

  it("vacío no muestra mensaje", () => {
    expect(analyzeTaxId("").message).toBeNull();
  });

  it("dígito verificador del RNC", () => {
    // 1-01-01062-1: RNC de ejemplo con verificador correcto según el algoritmo módulo 11.
    const base = "10101062";
    const weights = [7, 9, 8, 6, 5, 4, 3, 2];
    const sum = weights.reduce((acc, w, i) => acc + w * Number(base[i]), 0);
    const mod = sum % 11;
    const check = mod === 0 ? 2 : mod === 1 ? 1 : 11 - mod;
    expect(isValidRnc(base + check)).toBe(true);
    expect(isValidRnc(base + ((check + 1) % 10))).toBe(false);
  });

  it("dígito verificador de la Cédula (Luhn)", () => {
    expect(isValidCedula("00100000001")).toBe(false);
    // construir una cédula válida
    const base = "0011234567";
    let sum = 0;
    for (let i = 0; i < 10; i++) {
      let p = Number(base[i]) * (i % 2 === 0 ? 1 : 2);
      if (p >= 10) p = Math.floor(p / 10) + (p % 10);
      sum += p;
    }
    const check = (10 - (sum % 10)) % 10;
    expect(isValidCedula(base + check)).toBe(true);
    expect(analyzeTaxId(base + check).checksumOk).toBe(true);
    expect(analyzeTaxId(base + ((check + 1) % 10)).tone).toBe("warning");
  });

  it("formato visual", () => {
    expect(formatTaxId("101012345")).toBe("1-01-01234-5");
    expect(formatTaxId("00112345678")).toBe("001-1234567-8");
    expect(formatTaxId("ABC123")).toBe("ABC123");
  });
});
