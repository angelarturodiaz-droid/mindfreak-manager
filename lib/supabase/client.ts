import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente de Supabase para Client Components (navegador).
 * Usa la clave pública (publishable/anon) — nunca la service_role aquí.
 * Ver F0-Arquitectura, sección I (Auth).
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
