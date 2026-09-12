import { z } from "zod";

export const TASK_STATUSES = ["PENDING", "IN_PROGRESS", "DONE", "CANCELLED"] as const;
export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;

export const taskSchema = z.object({
  project_id: z.string().uuid().optional().or(z.literal("")),
  assigned_to: z.string().uuid().optional().or(z.literal("")),
  title: z.string().trim().min(1, "El título es requerido"),
  description: z.string().trim().optional().or(z.literal("")),
  due_date: z.string().optional().or(z.literal("")),
  priority: z.enum(TASK_PRIORITIES).default("MEDIUM"),
});
