import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { runReminders } from "@/features/reminders/engine";
import { getAppUrl } from "@/lib/utils/app-url";

/**
 * Tarea diaria de recordatorios (migración 086): pg_cron + pg_net llaman
 * aquí a las 8:15 a. m. con la cabecera `x-reminders-secret` (guardada solo
 * en Supabase Vault). La app no conoce ni guarda la clave: la pasa a la base
 * y la base la valida. Sin sesión de usuario y sin secret key.
 */
export async function POST(request: Request) {
  const secret = request.headers.get("x-reminders-secret");
  if (!secret || secret.length < 32) {
    return Response.json({ error: "No autorizado." }, { status: 401 });
  }
  const supabase = createSupabaseJsClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  try {
    const result = await runReminders({
      supabase,
      secret,
      source: "CRON",
      dryRun: false,
      origin: await getAppUrl(),
    });
    // Solo conteos: nada de correos ni datos de clientes en la respuesta.
    return Response.json({
      today: result.today,
      planned: result.planned.length,
      sent: result.sent,
      failed: result.failed,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const forbidden = message.includes("reminders_forbidden");
    console.error("cron/reminders:", forbidden ? "clave no válida" : message);
    return Response.json({ error: forbidden ? "No autorizado." : "Error al revisar recordatorios." }, { status: forbidden ? 401 : 500 });
  }
}
