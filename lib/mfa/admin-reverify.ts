import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Reverifica el MFA del admin autenticado en la sesión actual — para
 * acciones especialmente sensibles hechas SOBRE OTRO usuario (cambiar su
 * correo, eliminar su cuenta) donde no basta con que la sesión del admin
 * ya esté en aal2 desde el login. No basta con mirar
 * getAuthenticatorAssuranceLevel() (eso solo confirma que se verificó AL
 * INICIAR SESIÓN, no en este instante) — hace un challenge+verify nuevo
 * contra el factor TOTP del propio admin, con el código que mandó desde
 * el formulario.
 *
 * Lanza (Error) si el código es inválido, si no coincide, o si el admin
 * no tiene un autenticador activo. Si no lanza, devuelve el User del
 * admin ya reverificado.
 */
export async function reverifyAdminMfa(supabase: SupabaseServerClient, mfaCode: string) {
  const code = mfaCode.trim();
  if (!/^\d{6}$/.test(code)) {
    throw new Error("Escribe el código de 6 dígitos de tu autenticador.");
  }

  const {
    data: { user: adminUser },
  } = await supabase.auth.getUser();
  if (!adminUser) throw new Error("Tu sesión expiró. Vuelve a iniciar sesión.");

  const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
  if (factorsError) throw new Error(factorsError.message);
  const factor = factors.totp.find((f) => f.status === "verified");
  if (!factor) {
    throw new Error("Tu cuenta no tiene un autenticador activo — actívalo desde tu perfil antes de continuar.");
  }

  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: factor.id });
  if (challengeError) throw new Error(challengeError.message);

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId: factor.id,
    challengeId: challenge.id,
    code,
  });
  if (verifyError) throw new Error("Código incorrecto. Intenta de nuevo.");

  return adminUser;
}
