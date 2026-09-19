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
  X,
} from "lucide-react";
import { useSidebar } from "./sidebar-context";

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
  const { mobileOpen, setMobileOpen } = useSidebar();

  return (
    <>
      {/* Overlay oscuro detrás del drawer en móvil/tablet */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-brand-border bg-brand-surface shadow-[var(--shadow-lg)] transition-transform duration-200 md:static md:z-auto md:shadow-none md:transition-[width] ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0 ${collapsed ? "md:w-16" : "md:w-60"} w-64`}
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
          <p className="flex-1 truncate text-sm font-semibold text-brand-primary">{platformName}</p>
        )}
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          aria-label="Cerrar menú"
          className="text-brand-muted hover:text-brand-text md:hidden"
        >
          <X size={18} />
        </button>
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
        className="hidden items-center gap-2 border-t border-brand-border px-4 py-3 text-xs text-brand-muted hover:bg-brand-surface-hover hover:text-brand-text md:flex"
      >
        {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
        {!collapsed && "Colapsar"}
      </button>
      </aside>
    </>
  );
}
