import { z } from "zod";

export const organizationSchema = z.object({
  legal_name: z.string().trim().optional().or(z.literal("")),
  tax_id: z.string().trim().optional().or(z.literal("")),
  address: z.string().trim().optional().or(z.literal("")),
  phone: z.string().trim().optional().or(z.literal("")),
  email: z.string().trim().email("Correo inválido").optional().or(z.literal("")),
  base_currency: z.enum(["DOP", "USD"]).default("DOP"),
});

export const systemSchema = z.object({
  platform_name: z.string().trim().min(1, "El nombre de la plataforma es requerido"),
  brand_primary: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Debe ser un color hex, ej. #17A6B8"),
  brand_accent: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Debe ser un color hex, ej. #17A6B8"),
});
