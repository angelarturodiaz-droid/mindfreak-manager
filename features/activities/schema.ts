import { z } from "zod";

export const ACTIVITY_TYPES = ["CALL", "MEETING", "EMAIL", "NOTE", "OTHER"] as const;

export const activitySchema = z.object({
  type: z.enum(ACTIVITY_TYPES).default("NOTE"),
  description: z.string().trim().min(1, "La descripción es requerida"),
  activity_date: z.string().optional().or(z.literal("")),
});
