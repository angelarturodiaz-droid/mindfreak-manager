import { z } from "zod";

export const serviceCategorySchema = z.object({
  name: z.string().trim().min(1, "El nombre es requerido"),
  description: z.string().trim().optional().or(z.literal("")),
});

export type ServiceCategoryInput = z.infer<typeof serviceCategorySchema>;

export const serviceSchema = z.object({
  name: z.string().trim().min(1, "El nombre es requerido"),
  category_id: z.string().uuid().optional().or(z.literal("")),
  unit: z.string().trim().optional().or(z.literal("")),
  default_price: z.coerce.number().min(0, "Debe ser un número positivo").default(0),
  default_cost: z.coerce.number().min(0, "Debe ser un número positivo").default(0),
});

export type ServiceInput = z.infer<typeof serviceSchema>;
