import { z } from "zod";

/** Perfil fiscal del proveedor (migración 072). Etiquetas en lenguaje sencillo. */

export const SUPPLIER_KINDS = ["PERSONA_FISICA", "PERSONA_JURIDICA", "UNICO_DUENO", "OTRO"] as const;
export const SUPPLIER_KIND_LABELS: Record<string, string> = {
  PERSONA_FISICA: "Persona Física",
  PERSONA_JURIDICA: "Persona Jurídica",
  UNICO_DUENO: "Negocio de Único Dueño",
  OTRO: "Otro",
};

export const FISCAL_CONDITIONS = ["REGISTRADO", "INFORMAL", "RST", "OTRO"] as const;
export const FISCAL_CONDITION_LABELS: Record<string, string> = {
  REGISTRADO: "Registrado DGII",
  INFORMAL: "Informal / no registrado",
  RST: "RST (régimen simplificado)",
  OTRO: "Otro",
};

export const ID_TYPES = ["RNC", "CEDULA", "PASAPORTE", "EXTRANJERO"] as const;
export const ID_TYPE_LABELS: Record<string, string> = {
  RNC: "RNC",
  CEDULA: "Cédula",
  PASAPORTE: "Pasaporte",
  EXTRANJERO: "Identificación extranjera",
};

export const E_ISSUER_VALUES = ["SI", "NO", "NO_CONFIRMADO"] as const;
export const E_ISSUER_LABELS: Record<string, string> = {
  SI: "Sí, emite e-CF",
  NO: "No",
  NO_CONFIRMADO: "No confirmado",
};

export const TAX_RESIDENCES = ["DO", "EXTRANJERO"] as const;

/** Países frecuentes para el selector (ISO 3166-1 alfa-2). */
export const COUNTRIES: { code: string; name: string }[] = [
  { code: "US", name: "Estados Unidos" },
  { code: "ES", name: "España" },
  { code: "MX", name: "México" },
  { code: "CO", name: "Colombia" },
  { code: "PR", name: "Puerto Rico" },
  { code: "PA", name: "Panamá" },
  { code: "CA", name: "Canadá" },
  { code: "GB", name: "Reino Unido" },
  { code: "FR", name: "Francia" },
  { code: "IT", name: "Italia" },
  { code: "DE", name: "Alemania" },
  { code: "CN", name: "China" },
  { code: "BR", name: "Brasil" },
  { code: "AR", name: "Argentina" },
  { code: "CL", name: "Chile" },
  { code: "PE", name: "Perú" },
  { code: "VE", name: "Venezuela" },
  { code: "HT", name: "Haití" },
  { code: "OT", name: "Otro" },
];

const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.enum(values).optional().or(z.literal("").transform(() => undefined));

export const supplierFiscalSchema = z
  .object({
    id_type: optionalEnum(ID_TYPES),
    supplier_kind: optionalEnum(SUPPLIER_KINDS),
    fiscal_condition: optionalEnum(FISCAL_CONDITIONS),
    tax_residence: z.enum(TAX_RESIDENCES).default("DO"),
    country_code: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, "País inválido.").optional().or(z.literal("")),
    foreign_tax_id: z.string().trim().max(60).optional().or(z.literal("")),
    e_issuer: z.enum(E_ISSUER_VALUES).default("NO_CONFIRMADO"),
  })
  .superRefine((v, ctx) => {
    if (v.tax_residence === "EXTRANJERO" && !v.country_code) {
      ctx.addIssue({ code: "custom", message: "Indica el país del proveedor extranjero." });
    }
  });

export type SupplierFiscalInput = z.infer<typeof supplierFiscalSchema>;

/** Lee los campos fiscales del formulario y los deja listos para guardar. */
export function parseSupplierFiscal(formData: FormData) {
  const parsed = supplierFiscalSchema.safeParse({
    id_type: String(formData.get("id_type") ?? ""),
    supplier_kind: String(formData.get("supplier_kind") ?? ""),
    fiscal_condition: String(formData.get("fiscal_condition") ?? ""),
    tax_residence: String(formData.get("tax_residence") ?? "DO") || "DO",
    country_code: String(formData.get("country_code") ?? ""),
    foreign_tax_id: String(formData.get("foreign_tax_id") ?? ""),
    e_issuer: String(formData.get("e_issuer") ?? "NO_CONFIRMADO") || "NO_CONFIRMADO",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos fiscales inválidos." } as const;
  const v = parsed.data;
  const foreign = v.tax_residence === "EXTRANJERO";
  return {
    data: {
      id_type: v.id_type ?? null,
      supplier_kind: v.supplier_kind ?? null,
      fiscal_condition: v.fiscal_condition ?? null,
      tax_residence: v.tax_residence,
      country_code: foreign ? v.country_code || null : null,
      foreign_tax_id: foreign ? v.foreign_tax_id || null : null,
      e_issuer: v.e_issuer,
    },
  } as const;
}

/** Resumen corto para chips: "Persona Física · Registrado DGII · Emite e-CF". */
export function fiscalSummary(s: {
  supplier_kind?: string | null;
  fiscal_condition?: string | null;
  tax_residence?: string | null;
  country_code?: string | null;
  e_issuer?: string | null;
}): string[] {
  const parts: string[] = [];
  if (s.supplier_kind) parts.push(SUPPLIER_KIND_LABELS[s.supplier_kind] ?? s.supplier_kind);
  if (s.fiscal_condition) parts.push(FISCAL_CONDITION_LABELS[s.fiscal_condition] ?? s.fiscal_condition);
  if (s.tax_residence === "EXTRANJERO") {
    parts.push(`Extranjero${s.country_code ? ` (${COUNTRIES.find((c) => c.code === s.country_code)?.name ?? s.country_code})` : ""}`);
  }
  if (s.e_issuer === "SI") parts.push("Emite e-CF");
  return parts;
}

export const FISCAL_PROFILE_KEYS = [
  "id_type",
  "supplier_kind",
  "fiscal_condition",
  "tax_residence",
  "country_code",
  "foreign_tax_id",
  "e_issuer",
] as const;
