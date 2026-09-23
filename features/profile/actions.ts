"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { updateProfileSchema, changePasswordSchema } from "./schema";
import { generateRecoveryCodes, hashRecoveryCode, RECOVERY_CODE_COUNT } from "@/lib/mfa/recovery-codes";
import { TRUSTED_DEVICE_COOKIE, hashTrustedDeviceToken } from "@/lib/mfa/trusted-devices";

export type ActionState = { error: string | null; success?: boolean };

export async function updateOwnPhoneAction(phone: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sesión no encontrada.");

  const { error } = await supabase
    .from("profiles")
    .update({ phone: phone.trim() || null })
    .eq("id", user.id);
  if (error) throw new Error(error.message);

  revalidatePath("/profile");
}

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

export type MfaEnrollResult = { factorId: string; qrCode: string; secret: string };

/** Inicia la activación del autenticador — genera el QR y la clave manual. */
export async function enrollMfaAction(): Promise<MfaEnrollResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
  if (error) throw new Error(error.message);
  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
}

/** Confirma la activación con el código de 6 dígitos que generó la app. */
export async function verifyMfaEnrollmentAction(factorId: string, code: string): Promise<void> {
  const supabase = await createClient();
  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
  if (challengeError) throw new Error(challengeError.message);

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code: code.trim(),
  });
  if (verifyError) throw new Error("Código incorrecto. Verifica la hora de tu teléfono e intenta de nuevo.");

  // Si la reconfiguración venía de haber usado un código de recuperación
  // (ver verifyRecoveryCodeAction), limpia el candado que la obligaba a
  // pasar por acá antes de usar el resto del sistema. updateUser({ data })
  // MEZCLA con el user_metadata existente (no lo reemplaza), así que es
  // seguro llamarlo aunque el flag nunca haya estado activo.
  await supabase.auth.updateUser({ data: { mfa_reset_pending: false } });

  revalidatePath("/profile");
}

/** Cancela una activación a medias (el usuario cerró antes de confirmar el código). */
export async function cancelMfaEnrollmentAction(factorId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.mfa.unenroll({ factorId });
}

/** Quita el autenticador ya activo. */
export async function unenrollMfaAction(factorId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) throw new Error(error.message);
  revalidatePath("/profile");
}

export async function getMfaFactorsAction() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw new Error(error.message);
  return data.totp;
}

// ---------------------------------------------------------------------
// Códigos de recuperación de MFA
// ---------------------------------------------------------------------

export type RecoveryCodesStatus = {
  total: number;
  remaining: number;
  generatedAt: string | null;
};

/** Estado actual de los códigos (para mostrar "8 de 10 sin usar" en el perfil) — nunca expone los códigos. */
export async function getRecoveryCodesStatusAction(): Promise<RecoveryCodesStatus> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sesión no encontrada.");

  const { data, error } = await supabase
    .from("mfa_recovery_codes")
    .select("used_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const total = data?.length ?? 0;
  const remaining = data?.filter((c) => !c.used_at).length ?? 0;
  const generatedAt = data?.[0]?.created_at ?? null;
  return { total, remaining, generatedAt };
}

/**
 * Genera 10 códigos de recuperación nuevos e invalida los anteriores.
 * Requiere el autenticador activo (no tiene sentido sin MFA). Se devuelven
 * en texto plano UNA sola vez — la base de datos solo guarda el hash.
 */
export async function generateRecoveryCodesAction(): Promise<string[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sesión no encontrada.");

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const hasVerifiedFactor = (factors?.totp ?? []).some((f) => f.status === "verified");
  if (!hasVerifiedFactor) {
    throw new Error("Activa el autenticador antes de generar códigos de recuperación.");
  }

  const codes = generateRecoveryCodes(RECOVERY_CODE_COUNT);

  // Regenerar invalida los anteriores (se borran, no se acumulan).
  const { error: deleteError } = await supabase.from("mfa_recovery_codes").delete().eq("user_id", user.id);
  if (deleteError) throw new Error(deleteError.message);

  const { error: insertError } = await supabase.from("mfa_recovery_codes").insert(
    codes.map((code) => ({ user_id: user.id, code_hash: hashRecoveryCode(code) })),
  );
  if (insertError) throw new Error(insertError.message);

  revalidatePath("/profile");
  return codes;
}

// ---------------------------------------------------------------------
// Equipos de confianza ("recordar este equipo" al verificar MFA)
// ---------------------------------------------------------------------

export type TrustedDeviceRow = {
  id: string;
  label: string | null;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  isCurrent: boolean;
};

/** Lista los equipos marcados como "de confianza" para la cuenta actual. */
export async function listTrustedDevicesAction(): Promise<TrustedDeviceRow[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sesión no encontrada.");

  const cookieStore = await cookies();
  const currentToken = cookieStore.get(TRUSTED_DEVICE_COOKIE)?.value;
  const currentHash = currentToken ? hashTrustedDeviceToken(currentToken) : null;

  const { data, error } = await supabase
    .from("mfa_trusted_devices")
    .select("id, label, created_at, last_used_at, expires_at, token_hash")
    .eq("user_id", user.id)
    .order("last_used_at", { ascending: false });
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id,
    label: row.label,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    expiresAt: row.expires_at,
    isCurrent: currentHash !== null && row.token_hash === currentHash,
  }));
}

/** Revoca un equipo de confianza — la próxima vez que entre desde ahí, vuelve a pedir el código. */
export async function revokeTrustedDeviceAction(id: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sesión no encontrada.");

  // Filtro explícito por user_id además de RLS (defensa en profundidad):
  // sin esto, cualquier usuario autenticado podía revocar el equipo de
  // confianza de otro usuario con solo adivinar/enumerar su id.
  const { error } = await supabase
    .from("mfa_trusted_devices")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/profile");
}

/** Revoca todos los equipos de confianza de la cuenta a la vez. */
export async function revokeAllTrustedDevicesAction(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sesión no encontrada.");

  const { error } = await supabase.from("mfa_trusted_devices").delete().eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/profile");
}
