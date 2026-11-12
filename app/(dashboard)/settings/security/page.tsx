import Link from "next/link";
import { getCompany } from "@/features/settings/queries";
import { sanitizeIdleMinutes } from "@/lib/session/idle";
import { IdleTimeoutForm } from "./idle-timeout-form";

export default async function SecuritySettingsPage() {
  const company = await getCompany();
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <div>
        <h2 className="mb-1 text-lg font-semibold text-brand-primary">Seguridad</h2>
        <p className="text-sm text-brand-muted">
          El inicio de sesión, la verificación en dos pasos y la recuperación de contraseña los maneja el sistema de acceso
          (Supabase). Aquí se configura lo propio de la aplicación.
        </p>
      </div>

      <IdleTimeoutForm current={sanitizeIdleMinutes((company as { idle_timeout_minutes?: number }).idle_timeout_minutes)} />

      <p className="text-sm text-brand-muted">
        Quién puede hacer qué se revisa en{" "}
        <Link href="/settings/roles" className="text-brand-accent hover:underline">
          Roles y permisos
        </Link>{" "}
        y{" "}
        <Link href="/settings/users" className="text-brand-accent hover:underline">
          Usuarios
        </Link>
        . El registro de quién hizo qué y cuándo está en{" "}
        <Link href="/audit" className="text-brand-accent hover:underline">
          Auditoría
        </Link>
        .
      </p>
    </div>
  );
}
