"use client";

import { Menu } from "lucide-react";
import { useSidebar } from "./sidebar-context";

/** Botón hamburguesa, visible solo en móvil/tablet (oculto en md+). */
export function MobileMenuButton() {
  const { setMobileOpen } = useSidebar();
  return (
    <button
      type="button"
      onClick={() => setMobileOpen(true)}
      aria-label="Abrir menú"
      className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-brand-muted hover:bg-brand-surface-hover hover:text-brand-accent md:hidden"
    >
      <Menu size={20} />
    </button>
  );
}
