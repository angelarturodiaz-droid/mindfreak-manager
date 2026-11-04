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
/** Funciones de la base que solo LEEN: se pueden repetir sin riesgo. */
const READ_ONLY_RPC = /\/rest\/v1\/rpc\/(has_permission|my_permissions)(\?|$)/;

function requestInfo(input: RequestInfo | URL, init?: RequestInit) {
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  return { method, url };
}

/**
 * fetch con reintento ante cortes de conexión pasajeros («fetch failed»: internet que se cae un
 * momento, la Mac que despierta, el servidor de desarrollo que se recarga). Solo reintenta lo que
 * únicamente LEE (GET/HEAD y las funciones de permisos): nunca un guardado, para no duplicarlo.
 */
export const resilientFetch: typeof fetch = async (input, init) => {
  const { method, url } = requestInfo(input, init);
  const safe = method === "GET" || method === "HEAD" || (method === "POST" && READ_ONLY_RPC.test(url));
  for (let attempt = 1; ; attempt++) {
    try {
      return await fetch(input, init);
    } catch (err) {
      const network = err instanceof TypeError;
      if (!safe || !network || attempt >= 3 || init?.signal?.aborted) throw err;
      await new Promise((r) => setTimeout(r, 300 * attempt));
    }
  }
};

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      global: { fetch: resilientFetch },
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
