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
  // /encuesta/{token}: encuesta de satisfacción que responde el cliente sin
  // cuenta. La página solo lee/escribe vía get_public_survey /
  // submit_public_survey, que validan el token (migración 068).
  const isPublicRoute =
    path === "/" || isAuthRoute || path === "/auth/confirm" || path.startsWith("/encuesta/");

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

  // Cuenta con reconfiguración de MFA pendiente — se usó un código de
  // recuperación (perdió el autenticador), lo que obliga a quitar el
  // factor MFA de la cuenta (ver verifyRecoveryCodeAction). No puede usar
  // el resto del sistema hasta que lo vuelva a activar desde su perfil.
  // Solo se intercepta la navegación normal (GET) — las Server Actions
  // (POST, como cerrar sesión desde cualquier página) siguen funcionando,
  // para no dejar a nadie sin forma de salir de la cuenta.
  if (
    user &&
    user.user_metadata?.mfa_reset_pending === true &&
    path !== "/profile" &&
    request.method === "GET"
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/profile";
    url.searchParams.set("mfa_reset", "1");
    return NextResponse.redirect(url);
  }

  // Prueba BD (migración 085): en cada navegación se revisa el estado de la
  // cuenta. Desactivada → se cierra la sesión y va a /login, aunque el equipo
  // esté "recordado". Usuario sin verificación en dos pasos (obligatoria para
  // todos) → debe activarla en Mi perfil antes de usar el sistema. Si la función todavía no
  // existe (migración sin aplicar) no se bloquea nada.
  if (user && !isPublicRoute && request.method === "GET" && path !== "/mfa-challenge") {
    const { data: status, error: statusError } = await supabase.rpc("session_status");
    if (!statusError && status) {
      const st = status as { active?: boolean; needs_mfa?: boolean };
      if (st.active === false) {
        await supabase.auth.signOut();
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        url.search = "?cuenta=desactivada";
        const res = NextResponse.redirect(url);
        // Llevar las cookies de sesión borradas por signOut.
        supabaseResponse.cookies.getAll().forEach((c) => res.cookies.set(c));
        return res;
      }
      if (st.needs_mfa === true && path !== "/profile") {
        const url = request.nextUrl.clone();
        url.pathname = "/profile";
        url.search = "?mfa_required=1";
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}
