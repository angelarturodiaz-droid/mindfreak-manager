import { z } from "zod";

export const taxRateSchema = z.object({
  name: z.string().trim().min(1, "El nombre es requerido"),
  rate: z.coerce.number().min(0, "Debe ser un número positivo"),
  is_default: z.coerce.boolean().default(false),
});

export type TaxRateInput = z.infer<typeof taxRateSchema>;
