import { z } from "zod";

export const createUserSchema = z.object({
  full_name: z.string().trim().min(1, "El nombre es requerido"),
  email: z.string().trim().email("Correo inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  role_ids: z.array(z.string().uuid()).min(1, "Selecciona al menos un rol"),
});
