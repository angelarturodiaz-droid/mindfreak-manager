import Link from "next/link";
import { getCompany } from "@/features/settings/queries";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/clients", label: "Clientes" },
  { href: "/suppliers", label: "Proveedores" },
  { href: "/services", label: "Productos y Servicios" },
  { href: "/quotations", label: "Cotizaciones" },
  { href: "/projects", label: "Proyectos" },
  { href: "/invoices", label: "Facturas" },
  { href: "/payments", label: "Cobros y pagos" },
  { href: "/expenses", label: "Gastos" },
  { href: "/banks", label: "Bancos" },
  { href: "/tasks", label: "Tareas" },
  { href: "/reports", label: "Reportes" },
  { href: "/audit", label: "Auditoría" },
];

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
      <aside className="w-56 border-r border-brand-muted/20 bg-brand-surface p-4">
        <div className="mb-6 flex items-center gap-2">
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-6 w-6 object-contain" />
          )}
          <p className="text-sm font-semibold text-brand-primary">{platformName}</p>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="px-2 py-1.5 text-sm text-brand-text hover:text-brand-accent"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-end border-b border-brand-muted/20 px-6 py-3">
          <Link
            href="/settings"
            title="Configuración"
            aria-label="Configuración"
            className="flex h-8 w-8 items-center justify-center text-brand-muted hover:text-brand-accent"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </Link>
        </header>
        <div className="flex flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}
