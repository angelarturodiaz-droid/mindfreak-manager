import { z } from "zod";
import { currencyCodeSchema } from "@/features/currencies/schema";

export const organizationSchema = z.object({
  legal_name: z.string().trim().optional().or(z.literal("")),
  tax_id: z.string().trim().optional().or(z.literal("")),
  address: z.string().trim().optional().or(z.literal("")),
  phone: z.string().trim().optional().or(z.literal("")),
  email: z.string().trim().email("Correo inválido").optional().or(z.literal("")),
  // Código ISO de 3 letras; se valida contra el catálogo de monedas activas en la acción.
  base_currency: currencyCodeSchema.default("DOP"),
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
