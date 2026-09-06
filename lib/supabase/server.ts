import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Cliente de Supabase para Server Components / Server Actions / Route Handlers.
 * Maneja la sesión vía cookies (SSR), nunca localStorage.
 * Ver F0-Arquitectura, sección I (Auth).
 *
 * IMPORTANTE: llamar de nuevo por cada request (no reutilizar una instancia
 * global), ya que las cookies cambian por request.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // setAll fue llamado desde un Server Component (no una Server
            // Action/Route Handler). Se puede ignorar si hay middleware
            // refrescando la sesión (ver middleware.ts).
          }
        },
      },
    },
  );
}
