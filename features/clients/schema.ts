import { z } from "zod";

export const clientSchema = z.object({
  name: z.string().trim().min(1, "El nombre es requerido"),
  tax_id: z.string().trim().optional().or(z.literal("")),
  email: z
    .string()
    .trim()
    .email("Correo inválido")
    .optional()
    .or(z.literal("")),
  phone: z.string().trim().optional().or(z.literal("")),
  address: z.string().trim().optional().or(z.literal("")),
  // 5b — datos opcionales para la factura electrónica.
  foreign_id: z.string().trim().max(40, "El ID extranjero es muy largo").optional().or(z.literal("")),
  province_code: z.string().regex(/^\d{6}$/).optional().or(z.literal("")),
  municipality_code: z.string().regex(/^\d{6}$/).optional().or(z.literal("")),
  // Migración 107 — país (vacío = RD) y, fuera de RD, estado/provincia y ciudad en texto.
  country_code: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, "País inválido.").optional().or(z.literal("")),
  region: z.string().trim().max(80, "El estado o provincia es muy largo (máximo 80).").optional().or(z.literal("")),
  city: z.string().trim().max(80, "La ciudad es muy larga (máximo 80).").optional().or(z.literal("")),
  // Etapa del pipeline comercial (Lead -> Prospecto -> Cliente). Independiente
  // del Estado (is_active): un Lead puede estar activo o inactivo sin dejar
  // de ser Lead — nunca se mezclan estos dos campos.
  stage: z.enum(["LEAD", "PROSPECT", "CLIENT"]).default("LEAD"),
});

export type ClientInput = z.infer<typeof clientSchema>;

export const clientContactSchema = z.object({
  full_name: z.string().trim().min(1, "El nombre es requerido"),
  position: z.string().trim().optional().or(z.literal("")),
  email: z
    .string()
    .trim()
    .email("Correo inválido")
    .optional()
    .or(z.literal("")),
  phone: z.string().trim().optional().or(z.literal("")),
  is_primary: z.boolean().default(false),
  /** Recibe los recordatorios de cobro (migración 086). */
  receives_billing: z.boolean().default(false),
});

export type ClientContactInput = z.infer<typeof clientContactSchema>;
