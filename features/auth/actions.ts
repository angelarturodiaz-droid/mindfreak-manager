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
    console.error("Error de login:", error.message);
    return { error: "Correo o contraseña incorrectos." };
  }

  // Si el usuario tiene el autenticador activado, la contraseña sola no
  // basta — falta el código de 6 dígitos antes de dejarlo entrar de
  // verdad (nivel de autenticación aal2).
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== aal.nextLevel) {
    redirect("/mfa-challenge");
  }

  redirect("/dashboard");
}

/** Verifica el código de 6 dígitos del autenticador tras el login (aal1 -> aal2). */
export async function verifyMfaChallengeAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const code = String(formData.get("code") ?? "").trim();
  if (!code) return { error: "Escribe el código de 6 dígitos." };

  const supabase = await createClient();

  const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
  if (factorsError) return { error: factorsError.message };
  const factor = factors.totp.find((f) => f.status === "verified");
  if (!factor) return { error: "No hay un autenticador activo en esta cuenta." };

  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
    factorId: factor.id,
  });
  if (challengeError) return { error: challengeError.message };

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId: factor.id,
    challengeId: challenge.id,
    code,
  });
  if (verifyError) return { error: "Código incorrecto. Intenta de nuevo." };

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
