"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  FileText,
  CalendarDays,
  Package,
  Truck,
  CheckSquare,
  Receipt,
  Wallet,
  CreditCard,
  Landmark,
  BarChart3,
  History,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

type NavItem = { href: string; label: string; icon: React.ComponentType<{ size?: number }> };
type NavGroup = { label: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  { label: "", items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }] },
  {
    label: "Comercial",
    items: [
      { href: "/clients", label: "Clientes", icon: Users },
      { href: "/quotations", label: "Cotizaciones", icon: FileText },
      { href: "/projects", label: "Proyectos", icon: CalendarDays },
    ],
  },
  {
    label: "Operaciones",
    items: [
      { href: "/services", label: "Productos y Servicios", icon: Package },
      { href: "/suppliers", label: "Proveedores", icon: Truck },
      { href: "/tasks", label: "Tareas", icon: CheckSquare },
    ],
  },
  {
    label: "Finanzas",
    items: [
      { href: "/invoices", label: "Facturas", icon: Receipt },
      { href: "/payments", label: "Cobros y pagos", icon: Wallet },
      { href: "/expenses", label: "Gastos", icon: CreditCard },
      { href: "/banks", label: "Bancos", icon: Landmark },
    ],
  },
  {
    label: "Análisis",
    items: [
      { href: "/reports", label: "Reportes", icon: BarChart3 },
      { href: "/audit", label: "Auditoría", icon: History },
    ],
  },
];

export function Sidebar({
  platformName,
  logoUrl,
}: {
  platformName: string;
  logoUrl: string | null;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`flex flex-col border-r border-brand-border bg-brand-surface transition-all ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      <div className="flex items-center gap-2 border-b border-brand-border px-4 py-4">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="h-7 w-7 shrink-0 object-contain" />
        ) : (
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-brand-primary text-xs font-bold text-white">
            {platformName.charAt(0)}
          </div>
        )}
        {!collapsed && (
          <p className="truncate text-sm font-semibold text-brand-primary">{platformName}</p>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-2 py-4">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi}>
            {group.label && !collapsed && (
              <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
                {group.label}
              </p>
            )}
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active = pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={`flex items-center gap-2.5 rounded-[var(--radius-md)] px-2.5 py-2 text-sm font-medium transition-colors ${
                      active
                        ? "bg-brand-accent-light text-brand-accent"
                        : "text-brand-text hover:bg-brand-surface-hover"
                    }`}
                  >
                    <Icon size={18} />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center gap-2 border-t border-brand-border px-4 py-3 text-xs text-brand-muted hover:bg-brand-surface-hover hover:text-brand-text"
      >
        {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
        {!collapsed && "Colapsar"}
      </button>
    </aside>
  );
}
