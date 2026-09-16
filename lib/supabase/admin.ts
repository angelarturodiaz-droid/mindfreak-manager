import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";

/**
 * Cliente de Supabase con la Secret Key (antes "service_role") — acceso
 * total, sin RLS, sin sesión de usuario. SOLO para operaciones que
 * requieren la API de administración de Auth (crear/eliminar usuarios,
 * gestionar factores MFA) que ningún usuario normal puede hacer, ni
 * siquiera un ADMIN de la app, porque Supabase Auth no expone esas
 * operaciones vía la key pública.
 *
 * NUNCA usar este cliente para leer/escribir datos de negocio — para eso
 * siempre `lib/supabase/server.ts` (respeta RLS). Cada función que use
 * este cliente debe primero verificar el permiso correspondiente
 * (`requirePermission`) usando el cliente normal, ANTES de tocar el admin.
 */
export function createAdminClient() {
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      "SUPABASE_SECRET_KEY no está configurada. Agrégala a .env.local " +
        "(Dashboard de Supabase > Settings > API Keys > 'secret'). " +
        "Necesaria para crear/gestionar usuarios desde la app.",
    );
  }

  return createSupabaseJsClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
