import { z } from "zod";

export const PROJECT_STATUSES = [
  "PLANNING",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;

export const projectHeaderSchema = z.object({
  name: z.string().trim().min(1, "El nombre es requerido"),
  client_id: z.string().uuid("Selecciona un cliente"),
  contact_id: z.string().uuid().optional().or(z.literal("")),
  manager_id: z.string().uuid().optional().or(z.literal("")),
  event_date: z.string().optional().or(z.literal("")),
  event_time: z.string().optional().or(z.literal("")),
  location_name: z.string().trim().optional().or(z.literal("")),
  address: z.string().trim().optional().or(z.literal("")),
  budget: z.coerce.number().min(0).default(0),
  notes: z.string().trim().optional().or(z.literal("")),
});

export type ProjectHeaderInput = z.infer<typeof projectHeaderSchema>;

export const projectItemSchema = z.object({
  service_id: z.string().uuid().optional().or(z.literal("")),
  description: z.string().trim().min(1, "La descripción es requerida"),
  quantity: z.coerce.number().positive("Debe ser mayor a 0"),
  unit_price: z.coerce.number().min(0),
  estimated_cost: z.coerce.number().min(0).default(0),
});

export type ProjectItemInput = z.infer<typeof projectItemSchema>;
