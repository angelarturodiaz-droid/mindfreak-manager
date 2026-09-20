import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Ruta a la que apunta el link de los correos de Auth (recuperar
 * contraseña, confirmar signup) — ver plantilla "Reset Password" en el
 * dashboard de Supabase (Authentication > Emails > Templates), que debe
 * enlazar aquí con `token_hash` y `type` en vez de usar el
 * `{{ .ConfirmationURL }}` por defecto (ese apunta al propio servidor de
 * Supabase, no a esta app, y no sirve para el flujo SSR con cookies).
 *
 * Canjea el token por una sesión real (vía cookies, patrón SSR) y sigue a
 * `next` — para recuperación de contraseña, `/update-password`.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/dashboard";

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      // Si la cuenta tiene MFA activo, Supabase exige la sesión en AAL2
      // (código verificado) antes de dejar cambiar la contraseña o el
      // correo, aunque la sesión venga de un link de recuperación válido
      // (esa sesión solo llega a AAL1). Sin este paso, /update-password
      // falla con "AAL2 session is required...".
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== aal.nextLevel) {
        redirect(`/mfa-challenge?next=${encodeURIComponent(next)}`);
      }
      redirect(next);
    }
  }

  redirect("/recover-password?error=link_invalido");
}
