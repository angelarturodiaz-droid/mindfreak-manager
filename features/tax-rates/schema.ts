import { z } from "zod";

export const TAX_TREATMENTS = ["GRAVADO", "EXENTO", "NO_SUJETO"] as const;

export const TAX_TREATMENT_LABELS: Record<(typeof TAX_TREATMENTS)[number], string> = {
  GRAVADO: "Gravado",
  EXENTO: "Exento",
  NO_SUJETO: "No sujeto",
};

export const taxRateSchema = z.object({
  name: z.string().trim().min(1, "El nombre es requerido"),
  rate: z.coerce.number().min(0, "Debe ser un número positivo"),
  // Tratamiento fiscal (Gravado/Exento/No sujeto). Si es Exento o No
  // sujeto, el ITBIS de cualquier línea que use esta tasa se calcula
  // en 0 sin importar el % configurado — ver features/invoices/actions.ts
  // y features/quotations/actions.ts.
  treatment: z.enum(TAX_TREATMENTS).default("GRAVADO"),
  is_default: z.coerce.boolean().default(false),
});

export type TaxRateInput = z.infer<typeof taxRateSchema>;
