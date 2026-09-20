"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

export type AuthActionState = {
  error: string | null;
  submitted?: boolean;
  requiresCaptcha?: boolean;
};

/** A partir de cuántos intentos fallidos seguidos (ventana de 15 min, ver
 * migración 051) se le exige un captcha a ese correo antes de reintentar. */
const CAPTCHA_THRESHOLD = 3;

/** Verifica el token de Cloudflare Turnstile contra la API de Cloudflare. */
async function verifyTurnstile(token: string, remoteIp: string | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  // Si no está configurado, no bloqueamos el login (evita dejar el sistema
  // inaccesible por una variable de entorno faltante) — solo no hay captcha.
  if (!secret) return true;
  if (!token) return false;

  try {
    const body = new URLSearchParams({ secret, response: token });
    if (remoteIp) body.set("remoteip", remoteIp);

    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = (await res.json()) as { success: boolean };
    return data.success === true;
  } catch (e) {
    console.error("Error verificando Turnstile:", e);
    return false;
  }
}

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

  // Comportamiento sospechoso: varios intentos fallidos seguidos con este
  // mismo correo → exigir captcha antes de intentar la contraseña de nuevo.
  const { data: currentAttempts } = await supabase.rpc("get_login_attempts", {
    p_identifier: email,
  });
  if ((currentAttempts ?? 0) >= CAPTCHA_THRESHOLD) {
    const token = String(formData.get("cf-turnstile-response") ?? "");
    const headersList = await headers();
    const remoteIp = headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const captchaOk = await verifyTurnstile(token, remoteIp);
    if (!captchaOk) {
      return {
        error: "Confirma que no eres un robot para continuar.",
        requiresCaptcha: true,
      };
    }
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    console.error("Error de login:", error.message);
    const { data: attempts } = await supabase.rpc("record_failed_login", {
      p_identifier: email,
    });
    return {
      error: "Correo o contraseña incorrectos.",
      requiresCaptcha: (attempts ?? 0) >= CAPTCHA_THRESHOLD,
    };
  }

  await supabase.rpc("reset_login_attempts", { p_identifier: email });

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

  const headersList = await headers();
  const origin =
    headersList.get("origin") ??
    `${headersList.get("x-forwarded-proto") ?? "https"}://${headersList.get("host")}`;

  const supabase = await createClient();
  // redirectTo apunta a la ruta que canjea el token del correo por una
  // sesión (ver app/auth/confirm/route.ts) y de ahí sigue a /update-password
  // para que el usuario escriba la contraseña nueva. Sin esto, Supabase usa
  // el Site URL por defecto del proyecto y el link termina en /login en vez
  // de en un formulario para poner la contraseña nueva.
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm?next=/update-password`,
  });

  // No revelamos si el correo existe o no (evita enumeración de usuarios).
  if (error) {
    console.error("Error solicitando recuperación:", error.message);
  }
  return { error: null, submitted: true };
}

/**
 * Establece la contraseña nueva tras hacer clic en el link de recuperación.
 * Requiere la sesión temporal de recuperación que crea
 * app/auth/confirm/route.ts al canjear el token del correo — si no hay
 * sesión (link vencido, ya usado, o se entró directo a la URL sin pasar por
 * el correo), no deja continuar.
 */
export async function updatePasswordAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (password.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres." };
  }
  if (password !== confirmPassword) {
    return { error: "Las contraseñas no coinciden." };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "El enlace venció o ya se usó. Solicita uno nuevo desde \"¿Olvidaste tu contraseña?\"." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    console.error("Error actualizando contraseña:", error.message);
    return { error: "No se pudo actualizar la contraseña. Intenta de nuevo." };
  }

  redirect("/dashboard");
}
