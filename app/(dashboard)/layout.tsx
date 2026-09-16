import Link from "next/link";
import { Settings } from "lucide-react";
import { getCompany } from "@/features/settings/queries";
import { getCurrentUser, hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";
import { UserMenu } from "@/components/layout/user-menu";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let platformName = "Mindfreak Manager";
  let logoUrl: string | null = null;
  let brandAccent = "#17a6b8";
  try {
    const company = await getCompany();
    platformName = company.platform_name || platformName;
    logoUrl = company.logo_url;
    brandAccent = company.brand_accent || brandAccent;
  } catch {
    // si falla (ej. sin compañía asignada todavía), se usa el nombre por defecto
  }

  const [user, canManageSettings] = await Promise.all([
    getCurrentUser(),
    hasPermission("settings.manage"),
  ]);

  let fullName: string | null = null;
  if (user) {
    const supabase = await createClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();
    fullName = profile?.full_name ?? null;
  }

  return (
    <div className="flex min-h-full flex-1">
      <Sidebar platformName={platformName} logoUrl={logoUrl} />
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-end gap-2 border-b border-brand-border bg-brand-surface px-6 py-3">
          {canManageSettings && (
            <Link
              href="/settings"
              title="Configuración"
              aria-label="Configuración"
              className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-brand-muted transition-colors hover:bg-brand-surface-hover hover:text-brand-accent"
            >
              <Settings size={18} />
            </Link>
          )}
          {user && <UserMenu fullName={fullName} email={user.email ?? ""} brandAccent={brandAccent} />}
        </header>
        <div className="flex flex-1 flex-col bg-brand-background">{children}</div>
      </div>
    </div>
  );
}
