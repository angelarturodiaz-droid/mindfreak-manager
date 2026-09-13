import Link from "next/link";
import { Settings } from "lucide-react";
import { getCompany } from "@/features/settings/queries";
import { Sidebar } from "@/components/layout/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let platformName = "Mindfreak Manager";
  let logoUrl: string | null = null;
  try {
    const company = await getCompany();
    platformName = company.platform_name || platformName;
    logoUrl = company.logo_url;
  } catch {
    // si falla (ej. sin compañía asignada todavía), se usa el nombre por defecto
  }

  return (
    <div className="flex min-h-full flex-1">
      <Sidebar platformName={platformName} logoUrl={logoUrl} />
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-end border-b border-brand-border bg-brand-surface px-6 py-3">
          <Link
            href="/settings"
            title="Configuración"
            aria-label="Configuración"
            className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-brand-muted transition-colors hover:bg-brand-surface-hover hover:text-brand-accent"
          >
            <Settings size={18} />
          </Link>
        </header>
        <div className="flex flex-1 flex-col bg-brand-background">{children}</div>
      </div>
    </div>
  );
}
