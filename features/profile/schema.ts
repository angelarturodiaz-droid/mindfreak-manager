import { z } from "zod";

export const updateProfileSchema = z.object({
  full_name: z.string().trim().min(1, "El nombre es requerido"),
  position: z.string().trim().optional().or(z.literal("")),
  phone: z.string().trim().optional().or(z.literal("")),
});

export const changePasswordSchema = z
  .object({
    current_password: z.string().min(1, "Escribe tu contraseña actual"),
    new_password: z.string().min(1, "Escribe la contraseña nueva."),
    confirm_password: z.string(),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: "Las contraseñas nuevas no coinciden",
    path: ["confirm_password"],
  });
