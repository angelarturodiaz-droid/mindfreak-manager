import type { ReactNode } from "react";
import { getMyPermissions } from "@/lib/auth/permissions";

/**
 * Muestra su contenido solo si el usuario tiene el permiso (ej. el botón
 * "Nuevo gasto" para quien puede crear gastos). Es solo visual: la acción
 * igual la valida el servidor.
 */
export async function IfCan({ permission, children }: { permission: string; children: ReactNode }) {
  const perms = await getMyPermissions();
  return perms.has(permission) ? <>{children}</> : null;
}
