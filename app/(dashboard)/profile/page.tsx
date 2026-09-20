import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getRecoveryCodesStatusAction, listTrustedDevicesAction } from "@/features/profile/actions";
import { EditProfileForm } from "./edit-profile-form";
import { ProfileTabs } from "./profile-tabs";
import { PasswordRow } from "./password-row";
import { PhoneRow } from "./phone-row";
import { AuthenticatorSetup } from "./authenticator-setup";
import { RecoveryCodesSetup } from "./recovery-codes-setup";
import { TrustedDevicesList } from "./trusted-devices-list";
import { SecurityRow, ComingSoonBadge } from "./security-row";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ mfa_reset?: string }>;
}) {
  const { mfa_reset } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, position, phone")
    .eq("id", user.id)
    .single();

  const { data: mfaFactors } = await supabase.auth.mfa.listFactors();
  const verifiedFactor = mfaFactors?.totp.find((f) => f.status === "verified") ?? null;
  const recoveryCodesStatus = await getRecoveryCodesStatusAction();
  const trustedDevices = await listTrustedDevicesAction();

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-8">
      <div>
        <h1 className="text-xl font-semibold text-brand-primary">Mi perfil</h1>
        <p className="text-sm text-brand-muted">{user.email}</p>
      </div>

      {(mfa_reset === "1" || user.user_metadata?.mfa_reset_pending === true) && (
        <div className="max-w-2xl rounded-[var(--radius-md)] border border-brand-warning bg-brand-warning-bg px-4 py-3 text-sm text-brand-warning">
          Usaste un código de recuperación para entrar, así que tu autenticador quedó desactivado por seguridad.
          Vuelve a activarlo abajo antes de seguir usando el sistema.
        </div>
      )}

      <ProfileTabs
        profileContent={
          <section className="max-w-md">
            <h2 className="mb-3 text-sm font-medium text-brand-text">
              Información personal
            </h2>
            <Card>
              <EditProfileForm
                fullName={profile?.full_name ?? null}
                position={profile?.position ?? null}
                phone={profile?.phone ?? null}
              />
            </Card>
          </section>
        }
        securityContent={
          <section className="max-w-2xl">
            <h2 className="text-base font-semibold text-brand-primary">
              Información de inicio de sesión
            </h2>
            <p className="mb-2 mt-1 text-sm text-brand-muted">
              Usaremos esta información para verificar tu identidad y
              proteger el acceso a tu cuenta.
            </p>
            <Card>
              <SecurityRow label="Id. de usuario">
                <span className="break-all text-brand-muted">{user.id}</span>
              </SecurityRow>
              <SecurityRow label="Correo electrónico">
                <div className="flex items-center justify-between">
                  <span>{user.email}</span>
                  <span className="text-xs text-brand-muted">
                    Contacta a un administrador para cambiarlo
                  </span>
                </div>
              </SecurityRow>
              <SecurityRow label="Contraseña">
                <PasswordRow />
              </SecurityRow>
              <SecurityRow label="Teléfono">
                <PhoneRow phone={profile?.phone ?? null} />
              </SecurityRow>
              <SecurityRow label="Autenticador">
                <AuthenticatorSetup initialFactor={verifiedFactor} />
              </SecurityRow>
              <SecurityRow label="Códigos de recuperación">
                <RecoveryCodesSetup initialStatus={recoveryCodesStatus} hasFactor={!!verifiedFactor} />
              </SecurityRow>
              <SecurityRow label="Equipos de confianza">
                <TrustedDevicesList initialDevices={trustedDevices} />
              </SecurityRow>
              <SecurityRow label="Verificación en dos pasos">
                <div className="flex items-center justify-between">
                  <span className="text-brand-muted">Capa extra de seguridad al iniciar sesión</span>
                  {verifiedFactor ? (
                    <Badge tone="success">Activada</Badge>
                  ) : (
                    <span className="text-xs text-brand-muted">Activa el autenticador arriba</span>
                  )}
                </div>
              </SecurityRow>
              <SecurityRow label="Claves de acceso">
                <div className="flex items-center justify-between">
                  <span className="text-brand-muted">Inicia sesión con tu huella o reconocimiento facial</span>
                  <ComingSoonBadge />
                </div>
              </SecurityRow>
            </Card>
          </section>
        }
      />
    </main>
  );
}
