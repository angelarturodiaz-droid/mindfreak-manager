"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type AuthActionState = { error: string | null; submitted?: boolean };

/** Login con email/contraseña. Registro es interno (sección I de F0), no hay signup público. */
export async function signIn(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Correo y contraseña son requeridos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Correo o contraseña incorrectos." };
  }

  redirect("/dashboard");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/** Solicitar link de recuperación de contraseña por correo. */
export async function requestPasswordReset(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "");
  if (!email) {
    return { error: "El correo es requerido." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email);

  // No revelamos si el correo existe o no (evita enumeración de usuarios).
  if (error) {
    console.error("Error solicitando recuperación:", error.message);
  }
  return { error: null, submitted: true };
}
