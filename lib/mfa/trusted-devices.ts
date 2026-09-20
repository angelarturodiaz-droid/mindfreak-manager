import { randomBytes, createHash } from "node:crypto";
import { cookies } from "next/headers";
import type { createClient } from "@/lib/supabase/server";

/** Nombre de la cookie httpOnly que identifica un "equipo de confianza". */
export const TRUSTED_DEVICE_COOKIE = "mf_trusted_device";

/** Cuántos días dura un equipo marcado como "de confianza" sin pedir MFA en el login. */
export const TRUSTED_DEVICE_DAYS = 90;

/** Token aleatorio de alta entropía — el valor real vive solo en la cookie del navegador. */
export function generateTrustedDeviceToken(): string {
  return randomBytes(32).toString("hex");
}

/** Hash del token — es lo único que se guarda en la base de datos. */
export function hashTrustedDeviceToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * ¿El equipo desde el que se conecta ya está marcado como "de confianza"
 * para este usuario (cookie + fila en mfa_trusted_devices, sin vencer)?
 * Si sí, refresca el "último uso" y deja saltar el paso de MFA en el
 * login normal — ver TRUSTED_DEVICE_DAYS. No reemplaza la verificación
 * real de Supabase para acciones sensibles (esas siguen pidiendo AAL2
 * aparte, sin importar el equipo).
 *
 * IMPORTANTE: esto se usa tanto en signIn() (features/auth/actions.ts)
 * como en app/(dashboard)/layout.tsx. Supabase nunca marca la sesión
 * como aal2 real cuando se salta el challenge por equipo de confianza —
 * no hay forma de "fingir" esa verificación ante Supabase — así que
 * CUALQUIER lugar que revise aal.nextLevel === "aal2" para decidir si
 * manda a /mfa-challenge debe llamar también esta función antes de
 * redirigir, o el "recordar este equipo" se deshace en la siguiente
 * navegación (el login lo deja pasar, pero la próxima página vuelve a
 * pedir el código porque currentLevel sigue en aal1).
 */
export async function isCurrentDeviceTrusted(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<boolean> {
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
