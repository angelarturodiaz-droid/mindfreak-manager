import { redirect } from "next/navigation";
import { cache } from "react";
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

/** Fallas de red pasajeras (internet que se cae un momento, la Mac que despierta): vale la pena reintentar. */
function isTransientNetworkError(message: string): boolean {
  return /fetch failed|network|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket|terminated/i.test(message);
}

/**
 * ¿El usuario actual tiene el permiso indicado? (ej. "clients.view")
 * - Se guarda durante la misma petición (React cache): la misma pantalla no pregunta dos veces lo mismo.
 * - Si falla la conexión con Supabase, reintenta 2 veces antes de responder «no».
 */
export const hasPermission = cache(async (permissionCode: string): Promise<boolean> => {
  const supabase = await createClient();
  for (let attempt = 1; attempt <= 3; attempt++) {
    const { data, error } = await supabase.rpc("has_permission", {
      permission_code: permissionCode,
    });
    if (!error) return Boolean(data);
    if (attempt === 3 || !isTransientNetworkError(error.message)) {
      console.error("Error verificando permiso:", permissionCode, error.message);
      return false;
    }
    await new Promise((r) => setTimeout(r, 250 * attempt));
  }
  return false;
});

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

/**
 * Permisos del usuario actual (una sola consulta por pantalla). Para mostrar
 * solo el menú y los botones que puede usar; la seguridad real sigue en el
 * servidor (requirePermission) y en la base (RLS).
 */
const getMyPermissionsResult = cache(async (): Promise<{ perms: Set<string>; failed: boolean }> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_permissions");
  if (error) {
    console.error("Error leyendo permisos:", error.message);
    return { perms: new Set(), failed: isTransientNetworkError(error.message) };
  }
  return { perms: new Set((data as string[] | null) ?? []), failed: false };
});

export async function getMyPermissions(): Promise<Set<string>> {
  return (await getMyPermissionsResult()).perms;
}

/** Mensaje cuando no se pudo hablar con la base (no es falta de permiso). */
export const CONNECTION_ERROR_MESSAGE =
  "No se pudo conectar con la base de datos (parece un corte de internet). Revisa la conexión y pulsa «Reintentar».";

/**
 * Para pantallas: si no tiene el permiso, lo manda al inicio con un aviso
 * ("No tienes permiso para entrar a Bancos") en vez de mostrar una pantalla
 * vacía o botones que fallan.
 */
export async function requirePageAccess(permissionCode: string, label: string): Promise<void> {
  const { perms, failed } = await getMyPermissionsResult();
  // Si no se pudo preguntar (corte de conexión), no decir «no tienes permiso»: mostrar el error de conexión.
  if (failed) throw new Error(CONNECTION_ERROR_MESSAGE);
  if (!perms.has(permissionCode)) {
    redirect(`/dashboard?sin_permiso=${encodeURIComponent(label)}`);
  }
}
