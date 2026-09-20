"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { headers, cookies } from "next/headers";
import { hashRecoveryCode } from "@/lib/mfa/recovery-codes";
import {
  TRUSTED_DEVICE_COOKIE,
  TRUSTED_DEVICE_DAYS,
  generateTrustedDeviceToken,
  hashTrustedDeviceToken,
} from "@/lib/mfa/trusted-devices";

export type AuthActionState = {
  error: string | null;
  submitted?: boolean;
  requiresCaptcha?: boolean;
};

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * ¿El equipo desde el que se conecta ya está marcado como "de confianza"
 * para este usuario (cookie + fila en mfa_trusted_devices, sin vencer)?
 * Si sí, refresca el "último uso" y deja saltar el paso de MFA en el
 * login normal — ver TRUSTED_DEVICE_DAYS. No reemplaza la verificación
 * real de Supabase para acciones sensibles (esas siguen pidiendo AAL2
 * aparte, sin importar el equipo).
 */
async function isCurrentDeviceTrusted(supabase: SupabaseServerClient, userId: string): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(TRUSTED_DEVICE_COOKIE)?.value;
  if (!token) return false;

  const tokenHash = hashTrustedDeviceToken(token);
  const { data, error } = await supabase
    .from("mfa_trusted_devices")
    .select("id, expires_at")
    .eq("user_id", userId)
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (error || !data) return false;
  if (new Date(data.expires_at).getTime() < Date.now()) return false;

  await supabase.from("mfa_trusted_devices").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);
  return true;
}

/** Marca el equipo actual como "de confianza" — cookie + fila, 90 días. */
async function trustCurrentDevice(supabase: SupabaseServerClient, userId: string): Promise<void> {
  const token = generateTrustedDeviceToken();
  const tokenHash = hashTrustedDeviceToken(token);
  const expiresAt = new Date(Date.now() + TRUSTED_DEVICE_DAYS * 24 * 60 * 60 * 1000);

  const { error } = await supabase.from("mfa_trusted_devices").insert({
    user_id: userId,
    token_hash: tokenHash,
    expires_at: expiresAt.toISOString(),
  });
  if (error) {
    console.error("Error guardando equipo de confianza:", error.message);
    return;
  }

  const cookieStore = await cookies();
  cookieStore.set(TRUSTED_DEVICE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TRUSTED_DEVICE_DAYS * 24 * 60 * 60,
  });
}

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
  // verdad (nivel de autenticación aal2). Excepción: si este equipo ya
  // está marcado como "de confianza" (checkbox "recordar este equipo" la
  // última vez), se salta este paso en el login normal — pero ojo, eso NO
  // exime de MFA en acciones sensibles más adelante (cambiar contraseña,
  // etc.): esas las sigue exigiendo Supabase aparte, sin importar el
  // equipo, porque no hay forma de "fingir" esa verificación.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== aal.nextLevel) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const trusted = user ? await isCurrentDeviceTrusted(supabase, user.id) : false;
    if (!trusted) {
      redirect("/mfa-challenge");
    }
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

  // "Recordar este equipo" — evita pedir el código en el login normal por
  // TRUSTED_DEVICE_DAYS días. No aplica cuando se viene de recuperar la
  // contraseña (no tendría sentido marcar el equipo de confianza en medio
  // de ese flujo) ni cuando ya estaba marcado.
  if (formData.get("rememberDevice") === "on") {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) await trustCurrentDevice(supabase, user.id);
  }

  // A dónde seguir tras verificar el código — normalmente /dashboard (login
  // normal), pero también se llega aquí desde /auth/confirm cuando la
  // cuenta tiene MFA y se está recuperando la contraseña (Supabase exige
  // AAL2 para cambiar la contraseña si hay MFA activo), en cuyo caso debe
  // volver a /update-password. Solo se acepta una ruta interna (empieza
  // con "/" y no con "//") para evitar un redirect abierto.
  const next = String(formData.get("next") ?? "/dashboard");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
}

/**
 * Entra con un código de recuperación de un solo uso en vez del código del
 * autenticador — para cuando se perdió el acceso al teléfono/app. No hay
 * forma de "fingir" ante Supabase que el autenticador se verificó, así que
 * la única salida técnica es quitar el factor MFA de la cuenta (por eso
 * necesita la Secret Key, no basta la sesión del propio usuario) y obligar
 * a reconfigurarlo — ver isCurrentDeviceTrusted, mfa_reset_pending en
 * lib/supabase/proxy.ts, y CHANGELOG.md para el detalle completo.
 */
export async function verifyRecoveryCodeAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const rawCode = String(formData.get("code") ?? "").trim();
  if (!rawCode) return { error: "Escribe un código de recuperación." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Tu sesión expiró. Vuelve a iniciar sesión." };

  const codeHash = hashRecoveryCode(rawCode);
  const { data: match } = await supabase
    .from("mfa_recovery_codes")
    .select("id")
    .eq("user_id", user.id)
    .eq("code_hash", codeHash)
    .is("used_at", null)
    .maybeSingle();

  if (!match) {
    return { error: "Código de recuperación inválido o ya usado." };
  }

  // Se marca usado antes de tocar el MFA, para que no se pueda reintentar
  // el mismo código aunque falle el paso siguiente.
  await supabase.from("mfa_recovery_codes").update({ used_at: new Date().toISOString() }).eq("id", match.id);

  let adminClient;
  try {
    adminClient = createAdminClient();
  } catch (e) {
    console.error("Error inicializando cliente admin para recuperación de MFA:", e);
    return { error: "No se pudo procesar el código. Contacta a un administrador." };
  }

  const { data: factorsData } = await adminClient.auth.admin.mfa.listFactors({ userId: user.id });
  for (const factor of factorsData?.factors ?? []) {
    await adminClient.auth.admin.mfa.deleteFactor({ userId: user.id, id: factor.id });
  }

  // Marca la cuenta como "reconfiguración de MFA pendiente" — el middleware
  // (lib/supabase/proxy.ts) bloquea el resto del sistema hasta que vuelva a
  // activar el autenticador desde /profile. Se lee-mezcla-escribe para no
  // pisar otras claves ya guardadas en user_metadata (ej. full_name).
  const { data: adminUser } = await adminClient.auth.admin.getUserById(user.id);
  await adminClient.auth.admin.updateUserById(user.id, {
    user_metadata: { ...(adminUser?.user?.user_metadata ?? {}), mfa_reset_pending: true },
  });

  redirect("/profile?mfa_reset=1");
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
