import Link from "next/link";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/clients", label: "Clientes" },
  { href: "/suppliers", label: "Proveedores" },
  { href: "/services", label: "Servicios" },
  { href: "/quotations", label: "Cotizaciones" },
  // El resto de los módulos se agregan a medida que se implementan (F9 en adelante)
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1">
      <aside className="w-56 border-r border-brand-muted/20 bg-brand-surface p-4">
        <p className="mb-6 text-sm font-semibold text-brand-primary">
          Mindfreak Manager
        </p>
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
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
