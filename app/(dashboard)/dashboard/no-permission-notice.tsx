"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ResultDialog } from "@/components/ui/result-dialog";

/** Ventana "No tienes permiso…" cuando una pantalla lo mandó al inicio. */
export function NoPermissionNotice() {
  const params = useSearchParams();
  const what = params.get("sin_permiso");
  const [closed, setClosed] = useState<string | null>(null);
  if (!what || closed === what) return null;
  return (
    <ResultDialog
      open
      tone="warning"
      title="No tienes permiso"
      onClose={() => {
        setClosed(what);
        window.history.replaceState(null, "", "/dashboard");
      }}
    >
      <p className="text-sm text-brand-muted">
        Tu rol no te permite {what}. Si lo necesitas, pídele al administrador que te dé ese permiso en{" "}
        <em>Configuración → Roles y permisos</em>.
      </p>
    </ResultDialog>
  );
}
