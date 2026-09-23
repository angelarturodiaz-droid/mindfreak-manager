import { z } from "zod";

export const serviceCategorySchema = z.object({
  name: z.string().trim().min(1, "El nombre es requerido"),
  description: z.string().trim().optional().or(z.literal("")),
});

export type ServiceCategoryInput = z.infer<typeof serviceCategorySchema>;

export const SERVICE_TYPES = ["PRODUCTO", "SERVICIO"] as const;

export const serviceSchema = z.object({
  name: z.string().trim().min(1, "El nombre es requerido"),
  category_id: z.string().uuid().optional().or(z.literal("")),
  type: z.enum(SERVICE_TYPES).default("SERVICIO"),
  description: z.string().trim().optional().or(z.literal("")),
  unit: z.string().trim().optional().or(z.literal("")),
  default_price: z.coerce.number().min(0, "Debe ser un número positivo").default(0),
  default_cost: z.coerce.number().min(0, "Debe ser un número positivo").default(0),
  // Tratamiento fiscal por defecto — referencia una tasa del catálogo
  // (Configuración → Impuestos). Opcional: si se deja vacío, al agregar el
  // servicio a una cotización/factura se usa la tasa predeterminada del
  // catálogo. Nunca se guarda aquí un % suelto — Settings es la única
  // fuente de tasas/tratamientos.
  default_tax_rate_id: z.string().uuid().optional().or(z.literal("")),
});

export type ServiceInput = z.infer<typeof serviceSchema>;
