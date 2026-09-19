"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { usePathname } from "next/navigation";

type SidebarContextValue = {
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

/**
 * Estado del drawer del sidebar en móvil/tablet. El sidebar en desktop
 * (md+) siempre es visible vía CSS y no depende de este estado — este
 * contexto solo controla el overlay que aparece en pantallas angostas.
 */
export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Cierra el drawer automáticamente al navegar a otra pantalla. El cambio
  // de ruta es un evento externo (no derivable durante el render), por lo
  // que sincronizarlo con un efecto es el patrón correcto aquí.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- cierre de drawer en respuesta a navegación externa, no un derivado de render
    setMobileOpen(false);
  }, [pathname]);

  return (
    <SidebarContext.Provider value={{ mobileOpen, setMobileOpen }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar debe usarse dentro de <SidebarProvider>");
  return ctx;
}
