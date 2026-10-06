import { describe, expect, it } from "vitest";
import { currencyCodeSchema, currencySchema, currencySettingsSchema, describeRate, exchangeRateSchema } from "@/features/currencies/schema";
import { invoiceHeaderSchema } from "@/features/invoices/schema";
import { parseBankRuleError, bankRuleState } from "@/lib/utils/bank-errors";

describe("Monedas y tasas (V5 paso 1)", () => {
  it("acepta códigos ISO de 3 letras y los pasa a mayúsculas", () => {
    expect(currencyCodeSchema.parse("eur")).toBe("EUR");
    expect(currencyCodeSchema.safeParse("US").success).toBe(false);
    expect(currencyCodeSchema.safeParse("US1").success).toBe(false);
  });

  it("los documentos aceptan monedas del catálogo, no solo DOP/USD", () => {
    const base = { client_id: "6a1e0f0e-1111-4111-8111-111111111111", issue_date: "2026-10-05", exchange_rate: 64 };
    const r = invoiceHeaderSchema.safeParse({ ...base, currency: "EUR" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.currency).toBe("EUR");
    expect(invoiceHeaderSchema.safeParse({ ...base, currency: "EURO" }).success).toBe(false);
  });

  it("describe la tasa con la convención única", () => {
    expect(describeRate("USD", 58.8, "DOP")).toBe("1 USD = 58.80 DOP");
  });

  it("tasa: mayor que 0 y fecha obligatoria", () => {
    const ok = exchangeRateSchema.safeParse({ currency_code: "USD", effective_date: "2026-10-05", rate_to_base: "58.80", source: "MANUAL" });
    expect(ok.success).toBe(true);
    expect(exchangeRateSchema.safeParse({ currency_code: "USD", effective_date: "2026-10-05", rate_to_base: "0", source: "MANUAL" }).success).toBe(false);
    expect(exchangeRateSchema.safeParse({ currency_code: "USD", effective_date: "", rate_to_base: "58", source: "MANUAL" }).success).toBe(false);
    expect(exchangeRateSchema.safeParse({ currency_code: "USD", effective_date: "2026-10-05", rate_to_base: "58", source: "API" }).success).toBe(false);
  });

  it("configuración: tolerancia no negativa y 'Otra fuente' exige nombre", () => {
    expect(currencySettingsSchema.safeParse({ reference_rate_source: "MANUAL", rounding_tolerance: "1" }).success).toBe(true);
    expect(currencySettingsSchema.safeParse({ reference_rate_source: "MANUAL", rounding_tolerance: "-1" }).success).toBe(false);
    expect(currencySettingsSchema.safeParse({ reference_rate_source: "OTHER", rounding_tolerance: "1" }).success).toBe(false);
    expect(currencySettingsSchema.safeParse({ reference_rate_source: "OTHER", reference_source_name: "Infodolar", rounding_tolerance: "1" }).success).toBe(true);
  });

  it("moneda nueva: nombre obligatorio, decimales 0–4", () => {
    expect(currencySchema.safeParse({ code: "eur", name: "Euro", symbol: "€", decimals: "2" }).success).toBe(true);
    expect(currencySchema.safeParse({ code: "EUR", name: "", decimals: "2" }).success).toBe(false);
    expect(currencySchema.safeParse({ code: "EUR", name: "Euro", decimals: "5" }).success).toBe(false);
  });

  it("el error de moneda diferente de la base se muestra como ventana 'Moneda diferente'", () => {
    const msg =
      'currency_mismatch: Moneda diferente. El movimiento está en DOP pero la cuenta «Promerica USD» está en USD. El saldo de una cuenta solo se mueve en su propia moneda.';
    expect(parseBankRuleError(msg)?.kind).toBe("error");
    const st = bankRuleState(msg);
    expect(st?.blockedTitle).toBe("Moneda diferente");
    expect(st?.blocked?.startsWith("El movimiento está en DOP")).toBe(true);
  });
});
