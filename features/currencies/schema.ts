import { z } from "zod";

/**
 * Multimoneda operacional V5 — paso 1 (migración 075). Convención única de
 * tasas: 1 unidad de la moneda no funcional = X unidades de la moneda
 * funcional (ej. 1 USD = 58.80 DOP). La moneda funcional es
 * companies.base_currency.
 */

/** Código ISO 4217 de 3 letras (DOP, USD, EUR…). Se valida contra el catálogo en el servidor. */
export const currencyCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, "La moneda debe ser un código de 3 letras (ej. DOP, USD, EUR).");

export const RATE_SOURCES = ["BCRD_DGII", "MANUAL", "BANK", "OTHER"] as const;
export type RateSource = (typeof RATE_SOURCES)[number];

export const RATE_SOURCE_LABELS: Record<RateSource, string> = {
  BCRD_DGII: "Banco Central / DGII",
  MANUAL: "Manual",
  BANK: "Banco",
  OTHER: "Otra fuente",
};

export const currencySchema = z.object({
  code: currencyCodeSchema,
  name: z.string().trim().min(2, "Escribe el nombre de la moneda.").max(60),
  symbol: z.string().trim().max(8, "El símbolo es muy largo.").default(""),
  decimals: z.coerce.number().int().min(0).max(4).default(2),
});

export const currencySettingsSchema = z
  .object({
    reference_rate_source: z.enum(RATE_SOURCES),
    reference_source_name: z.string().trim().max(80).optional().or(z.literal("")),
    rounding_tolerance: z.coerce
      .number({ message: "La tolerancia debe ser un número." })
      .min(0, "La tolerancia no puede ser negativa.")
      .max(1000, "La tolerancia es demasiado alta."),
  })
  .superRefine((v, ctx) => {
    if (v.reference_rate_source === "OTHER" && !v.reference_source_name) {
      ctx.addIssue({ code: "custom", message: "Como elegiste «Otra fuente», escribe su nombre para saber de dónde sale la tasa (por ejemplo, Infodolar o la casa de cambio que usas).", path: ["reference_source_name"] });
    }
  });

export const exchangeRateSchema = z.object({
  currency_code: currencyCodeSchema,
  effective_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige la fecha de la tasa."),
  rate_to_base: z.coerce
    .number({ message: "La tasa debe ser un número." })
    .positive("La tasa debe ser mayor que 0.")
    .max(1_000_000, "La tasa es demasiado alta."),
  source: z.enum(RATE_SOURCES),
  source_name: z.string().trim().max(80).optional().or(z.literal("")),
  notes: z.string().trim().max(200).optional().or(z.literal("")),
});

/** "1 USD = 58.80 DOP" */
export function describeRate(code: string, rate: number, functional: string): string {
  return `1 ${code} = ${new Intl.NumberFormat("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 6 }).format(rate)} ${functional}`;
}
