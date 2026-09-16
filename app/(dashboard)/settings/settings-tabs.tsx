"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/settings/organization", label: "Organización" },
  { href: "/settings/tax-rates", label: "Impuestos" },
  { href: "/settings/expense-categories", label: "Categorías de gastos" },
  { href: "/settings/banks", label: "Bancos" },
  { href: "/settings/system", label: "Sistema" },
  { href: "/settings/notifications", label: "Notificaciones" },
  { href: "/settings/documents", label: "Documentos" },
  { href: "/settings/security", label: "Seguridad" },
  { href: "/settings/users", label: "Usuarios" },
  { href: "/settings/roles", label: "Roles y permisos" },
];

export function SettingsTabs() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-1 border-b border-brand-border pb-px">
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={
              active
                ? "border-b-2 border-brand-accent px-3 py-2 text-sm font-medium text-brand-accent"
                : "border-b-2 border-transparent px-3 py-2 text-sm text-brand-muted hover:text-brand-text"
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
