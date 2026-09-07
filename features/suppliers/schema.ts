import { z } from "zod";

export const supplierSchema = z.object({
  name: z.string().trim().min(1, "El nombre es requerido"),
  tax_id: z.string().trim().optional().or(z.literal("")),
  category: z.string().trim().optional().or(z.literal("")),
  email: z
    .string()
    .trim()
    .email("Correo inválido")
    .optional()
    .or(z.literal("")),
  phone: z.string().trim().optional().or(z.literal("")),
  address: z.string().trim().optional().or(z.literal("")),
});

export type SupplierInput = z.infer<typeof supplierSchema>;

export const supplierContactSchema = z.object({
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

export type SupplierContactInput = z.infer<typeof supplierContactSchema>;
