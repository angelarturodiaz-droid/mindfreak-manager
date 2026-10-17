"use server";

import { getAppUrl } from "@/lib/utils/app-url";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { passwordProblem } from "@/lib/auth/password-policy";
import { headers, cookies } from "next/headers";
import { hashRecoveryCode } from "@/lib/mfa/recovery-codes";
import {
  TRUSTED_DEVICE_COOKIE,
  TRUSTED_DEVICE_DAYS,
  generateTrustedDeviceToken,
  hashTrustedDeviceToken,
  isCurrentDeviceTrusted,
} from "@/lib/mfa/trusted-devices";

const INACTIVE_ACCOUNT_MESSAGE =
  "Tu cuenta está desactivada. Habla con el administrador del sistema para volver a activarla.";

export type AuthActionState = {
  error: string | null;
  /** Cuenta bloqueada temporalmente por intentos fallidos. */
  locked?: boolean;
  submitted?: boolean;
  requiresCaptcha?: boolean;
};

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

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
/** Intentos fallidos seguidos tras los cuales el correo queda bloqueado 15 minutos. */
const LOCK_THRESHOLD = 5;
const LOCK_MINUTES = 15;

/** Hora (RD) a la que termina el bloqueo, para el mensaje. */
function lockMessage(lastAttemptAt: string | null): string {
  const until = new Date((lastAttemptAt ? new Date(lastAttemptAt).getTime() : Date.now()) + LOCK_MINUTES * 60_000);
  const hora = new Intl.DateTimeFormat("es-DO", { timeStyle: "short", timeZone: "America/Santo_Domingo" }).format(until);
  return `Por seguridad, esta cuenta quedó bloqueada ${LOCK_MINUTES} minutos por varios intentos fallidos. Podrás intentar de nuevo a las ${hora.replace(/\.$/, "")}. Si olvidaste tu contraseña, usa «¿Olvidaste tu contraseña?».`;
}

/** Verifica el token de Cloudflare Turnstile contra la API de Cloudflare. */
async function verifyTurnstile(token: string, remoteIp: string | null): Promise<boolean> {
  // En desarrollo (localhost) se usa la clave secreta de prueba de Cloudflare
  // (siempre pasa), igual que el widget: la real solo sirve en el dominio.
  const secret =
    process.env.NODE_ENV === "development"
      ? "1x0000000000000000000000000000000AA"
      : process.env.TURNSTILE_SECRET_KEY;
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

  // Las 3 llamadas rpc() de anti-fuerza-bruta de aquí abajo usan el
  // cliente ADMIN (service_role) a propósito, no el normal — son las
  // únicas del sistema que corren ANTES de que exista una sesión (por
  // definición: todavía se está iniciando sesión), así que no hay
  // permiso de usuario que verificar primero como en el resto de los
  // usos de este cliente. Antes se llamaban con el cliente normal (anon
  // key), lo que las dejaba expuestas también como endpoint público de
  // PostgREST (/rest/v1/rpc/reset_login_attempts) a cualquiera con la
  // anon key — pública por diseño — permitiendo resetear el contador de
  // intentos fallidos de OTRA persona sin pasar por esta pantalla,
  // anulando el captcha. Ver migración 053_security_hardening.sql, que
  // revoca el acceso público/anon/authenticated a estas 3 funciones y
  // las deja solo para service_role.
  //
  // Si SUPABASE_SECRET_KEY no está configurada, se falla "abierto" (se
  // deja entrar sin exigir captcha) en vez de romper el login por
  // completo — mismo criterio que verifyTurnstile() más abajo.
  let adminClient: ReturnType<typeof createAdminClient> | null = null;
  try {
    adminClient = createAdminClient();
  } catch (e) {
    console.error("signIn: no se pudo inicializar el cliente admin (SUPABASE_SECRET_KEY):", e);
  }

  // Comportamiento sospechoso: varios intentos fallidos seguidos con este
  // mismo correo → exigir captcha antes de intentar la contraseña de nuevo.
  const { data: currentAttempts } = adminClient
    ? await adminClient.rpc("get_login_attempts", { p_identifier: email })
    : { data: 0 };
  // Bloqueo temporal: 5 intentos fallidos seguidos → 15 minutos sin poder
  // intentar (ni siquiera con la contraseña correcta).
  if (adminClient && (currentAttempts ?? 0) >= LOCK_THRESHOLD) {
    const { data: row } = await adminClient
      .from("auth_login_attempts")
      .select("last_attempt_at")
      .eq("identifier", email.trim().toLowerCase())
      .maybeSingle();
    return { error: lockMessage(row?.last_attempt_at ?? null), locked: true };
  }

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

  // Cuenta desactivada por un administrador (bloqueada en Auth al desactivarla).
  if (error && (error.code === "user_banned" || /banned/i.test(error.message))) {
    return { error: INACTIVE_ACCOUNT_MESSAGE };
  }

  if (error) {
    console.error("Error de login:", error.message);
    const { data: attempts } = adminClient
      ? await adminClient.rpc("record_failed_login", { p_identifier: email })
      : { data: 0 };
    if ((attempts ?? 0) >= LOCK_THRESHOLD) {
      return { error: lockMessage(new Date().toISOString()), locked: true };
    }
    const left = LOCK_THRESHOLD - (attempts ?? 0);
    return {
      error:
        (attempts ?? 0) >= CAPTCHA_THRESHOLD
          ? `Correo o contraseña incorrectos. Te ${left === 1 ? "queda 1 intento" : `quedan ${left} intentos`} antes de que la cuenta se bloquee ${LOCK_MINUTES} minutos.`
          : "Correo o contraseña incorrectos.",
      requiresCaptcha: (attempts ?? 0) >= CAPTCHA_THRESHOLD,
    };
  }

  if (adminClient) {
    await adminClient.rpc("reset_login_attempts", { p_identifier: email });
  }

  // Segunda barrera: si el perfil está desactivado (aunque el bloqueo en Auth
  // no se haya aplicado), no se deja entrar, ni siquiera con "recordar equipo".
  {
    const {
      data: { user: signedIn },
    } = await supabase.auth.getUser();
    if (signedIn) {
      const { data: prof } = await supabase.from("profiles").select("is_active").eq("id", signedIn.id).maybeSingle();
      if (prof && prof.is_active === false) {
        await supabase.auth.signOut();
        return { error: INACTIVE_ACCOUNT_MESSAGE };
      }
    }
  }

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

  // Refresca la sesión — getAuthenticatorAssuranceLevel() (lo que usa el
  // layout del dashboard para exigir el paso de MFA) lee la sesión en
  // CACHÉ, no vuelve a consultar el servidor cada vez. Sin este refresh,
  // esa caché sigue mostrando el factor que se acaba de borrar, así que
  // el layout sigue pensando que falta verificar MFA (nextLevel se queda
  // en aal2) y redirige a /mfa-challenge — que a su vez rebota de vuelta
  // a /profile por el candado de abajo, en un bucle infinito.
  await supabase.auth.refreshSession();

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

  // Dominio público (APP_URL) para que el enlace del correo no apunte a localhost.
  const origin = await getAppUrl();

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

  if (password !== confirmPassword) {
    return { error: "Las contraseñas no coinciden." };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: prof } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
    const problem = passwordProblem(password, { email: user.email, name: prof?.full_name });
    if (problem) return { error: problem };
  }
  if (!user) {
    // Genérico a propósito — esta pantalla la usan dos flujos distintos:
    // recuperar contraseña ("¿Olvidaste tu contraseña?") e invitación de
    // un usuario nuevo (pide que un admin reenvíe la invitación).
    return { error: "El enlace venció o ya se usó. Pide que te lo reenvíen." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    console.error("Error actualizando contraseña:", error.message);
    return { error: "No se pudo actualizar la contraseña. Intenta de nuevo." };
  }

  redirect("/dashboard");
}
