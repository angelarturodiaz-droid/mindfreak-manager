import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refresca la sesión de Supabase en cada request (patrón oficial SSR).
 * Se invoca desde middleware.ts en la raíz del proyecto.
 * Ver F0-Arquitectura, sección I (Auth) y L (RLS): esto NO reemplaza la
 * verificación de permisos ni RLS, solo mantiene la cookie de sesión viva.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANTE: no eliminar esta llamada. Refresca el token si expiró.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAuthRoute = path === "/login" || path === "/recover-password";
  // /auth/confirm canjea el token del correo (recuperación, confirmación de
  // signup) por una sesión — no hay sesión todavía cuando llega la primera
  // vez, así que debe ser pública. No se agrega a isAuthRoute porque no
  // queremos forzar un redirect a /dashboard si el usuario ya tenía sesión:
  // la ruta hace su propio redirect a `next` (típicamente /update-password).
  const isPublicRoute = path === "/" || isAuthRoute || path === "/auth/confirm";

  // Sin sesión intentando entrar a una ruta protegida -> /login
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Con sesión intentando entrar a login/recover-password -> /dashboard
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
