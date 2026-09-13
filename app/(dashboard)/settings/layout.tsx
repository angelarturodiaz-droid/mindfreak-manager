import Link from "next/link";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/auth/permissions";

const TABS = [
  { href: "/settings/organization", label: "Organización" },
  { href: "/settings/tax-rates", label: "Impuestos" },
  { href: "/settings/expense-categories", label: "Categorías de gastos" },
  { href: "/settings/system", label: "Sistema" },
  { href: "/settings/notifications", label: "Notificaciones" },
  { href: "/settings/documents", label: "Documentos" },
  { href: "/settings/security", label: "Seguridad" },
  { href: "/settings/users", label: "Usuarios" },
];

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await hasPermission("settings.manage"))) {
    redirect("/dashboard");
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div>
        <h1 className="text-xl font-semibold text-brand-primary">Configuración</h1>
        <p className="text-sm text-brand-muted">
          Datos de la empresa, impuestos, categorías, marca y más.
        </p>
      </div>

      <nav className="flex flex-wrap gap-1 border-b border-brand-muted/20 pb-px">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className="border-b-2 border-transparent px-3 py-2 text-sm text-brand-muted hover:border-brand-accent hover:text-brand-text"
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <div>{children}</div>
    </main>
  );
}
