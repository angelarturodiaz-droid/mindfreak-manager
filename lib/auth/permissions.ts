import { createClient } from "@/lib/supabase/server";

/**
 * Capa de aplicación (2da de las 3 capas de la sección K de F0-Arquitectura).
 * SIEMPRE se usa junto con RLS (3ra capa) — nunca en su lugar. Esto solo evita
 * mostrar UI/ejecutar Server Actions que RLS igual bloquearía, dando mejor UX
 * (mensaje de error claro en vez de un error de base de datos crudo).
 */

/** Usuario autenticado actual, o null si no hay sesión. */
export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** ¿El usuario actual tiene el permiso indicado? (ej. "clients.view") */
export async function hasPermission(permissionCode: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("has_permission", {
    permission_code: permissionCode,
  });
  if (error) {
    console.error("Error verificando permiso:", permissionCode, error.message);
    return false;
  }
  return Boolean(data);
}

/**
 * Exige el permiso indicado; lanza un error legible si no lo tiene.
 * Uso típico al inicio de una Server Action:
 *   await requirePermission("clients.create");
 */
export async function requirePermission(permissionCode: string): Promise<void> {
  const allowed = await hasPermission(permissionCode);
  if (!allowed) {
    throw new Error(
      `No tienes permiso para realizar esta acción (${permissionCode}).`,
    );
  }
}

/** IDs de las compañías a las que pertenece el usuario actual. */
export async function getCurrentUserCompanyIds(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_roles")
    .select("company_id");
  if (error) {
    console.error("Error obteniendo compañías del usuario:", error.message);
    return [];
  }
  return [...new Set((data ?? []).map((r) => r.company_id))];
}
