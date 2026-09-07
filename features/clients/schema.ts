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
  status: z.enum(["LEAD", "ACTIVE"]).default("LEAD"),
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
});

export type ClientContactInput = z.infer<typeof clientContactSchema>;

export const CLIENT_CSV_COLUMNS = [
  "name",
  "tax_id",
  "email",
  "phone",
  "address",
  "status",
] as const;
