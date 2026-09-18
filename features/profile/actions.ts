"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { updateProfileSchema, changePasswordSchema } from "./schema";

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
