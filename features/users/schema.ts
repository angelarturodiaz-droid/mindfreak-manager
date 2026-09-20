import { z } from "zod";

export const createUserSchema = z.object({
  full_name: z.string().trim().min(1, "El nombre es requerido"),
  email: z.string().trim().email("Correo inválido"),
  role_ids: z.array(z.string().uuid()).min(1, "Selecciona al menos un rol"),
});
