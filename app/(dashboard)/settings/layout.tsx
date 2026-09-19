import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/auth/permissions";
import { SettingsTabs } from "./settings-tabs";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await hasPermission("settings.manage"))) {
    redirect("/dashboard");
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-8">
      <div>
        <h1 className="text-xl font-semibold text-brand-primary">Configuración</h1>
        <p className="text-sm text-brand-muted">
          Datos de la empresa, impuestos, categorías, marca y más.
        </p>
      </div>

      <SettingsTabs />

      <div>{children}</div>
    </main>
  );
}
