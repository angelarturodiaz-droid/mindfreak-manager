"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { updateProfileSchema, changePasswordSchema } from "./schema";

export type ActionState = { error: string | null; success?: boolean };

export async function updateOwnProfileAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión no encontrada." };

  const parsed = updateProfileSchema.safeParse({
    full_name: String(formData.get("full_name") ?? ""),
    position: String(formData.get("position") ?? ""),
    phone: String(formData.get("phone") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.full_name,
      position: parsed.data.position || null,
      phone: parsed.data.phone || null,
    })
    .eq("id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/profile");
  revalidatePath("/", "layout");
  return { error: null, success: true };
}

export async function changeOwnPasswordAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) return { error: "Sesión no encontrada." };

  const parsed = changePasswordSchema.safeParse({
    current_password: String(formData.get("current_password") ?? ""),
    new_password: String(formData.get("new_password") ?? ""),
    confirm_password: String(formData.get("confirm_password") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  // Se re-verifica la contraseña actual antes de permitir el cambio, para
  // que una sesión abierta y desatendida no baste para cambiarla.
  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.current_password,
  });
  if (reauthError) return { error: "La contraseña actual no es correcta." };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.new_password });
  if (error) return { error: error.message };

  return { error: null, success: true };
}
