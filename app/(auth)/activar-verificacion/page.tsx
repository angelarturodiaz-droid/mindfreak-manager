import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MfaSetupScreen } from "./mfa-setup-screen";

/**
 * Último paso de un usuario nuevo (o sin 2FA): activar la verificación en
 * dos pasos, obligatoria para todos (migración 085). Mismo estilo que las
 * pantallas de inicio de sesión y contraseña.
 */
export default async function ActivateMfaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: factors } = await supabase.auth.mfa.listFactors();
  if (factors?.totp.some((f) => f.status === "verified")) redirect("/dashboard");
  return <MfaSetupScreen email={user.email ?? ""} />;
}
