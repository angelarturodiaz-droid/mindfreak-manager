import Link from "next/link";
import { redirect } from "next/navigation";
import { Settings } from "lucide-react";
import { getCompany } from "@/features/settings/queries";
import { getCurrentUser, hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { listMyNotifications, countUnreadNotifications } from "@/features/notifications/queries";
import { Sidebar } from "@/components/layout/sidebar";
import { UserMenu } from "@/components/layout/user-menu";
import { NotificationBell } from "@/components/layout/notification-bell";
import { SidebarProvider } from "@/components/layout/sidebar-context";
import { MobileMenuButton } from "@/components/layout/mobile-menu-button";

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

  const [user, canManageSettings, notifications, unreadCount] = await Promise.all([
    getCurrentUser(),
    hasPermission("settings.manage"),
    listMyNotifications(),
    countUnreadNotifications(),
  ]);

  let fullName: string | null = null;
  if (user) {
    const supabase = await createClient();

    // Si el usuario tiene el autenticador activado pero todavía no
    // completó el código de esta sesión (ej. entró directo a una URL sin
    // pasar por /mfa-challenge), no se le deja ver nada del dashboard.
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== aal.nextLevel) {
      redirect("/mfa-challenge");
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();
    fullName = profile?.full_name ?? null;
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-full flex-1">
        <Sidebar platformName={platformName} logoUrl={logoUrl} />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-brand-border bg-brand-surface/95 px-4 py-3 shadow-[var(--shadow-sm)] backdrop-blur-sm md:px-6">
            <MobileMenuButton />
            <div className="flex-1" />
            {user && <NotificationBell notifications={notifications} unreadCount={unreadCount} />}
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
          <div className="flex flex-1 flex-col overflow-x-hidden bg-brand-background">{children}</div>
        </div>
      </div>
    </SidebarProvider>
  );
}
