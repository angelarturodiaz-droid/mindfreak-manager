import { headers } from "next/headers";

/**
 * Dirección pública de la app (ej. https://app.mindfreakevents.com), para
 * armar enlaces que salen del sistema: encuestas de satisfacción (correo y
 * WhatsApp), invitaciones de usuarios y recuperación de contraseña.
 *
 * Usa la variable de entorno APP_URL si está definida — así los enlaces
 * siempre llevan el dominio de Mindfreak, aunque la acción se haga desde
 * `npm run dev` en localhost o desde la dirección *.workers.dev. Si no está
 * definida, cae al dominio de la petición actual (comportamiento anterior).
 *
 * Solo para el servidor (Server Actions / Server Components).
 */
export async function getAppUrl(): Promise<string> {
  const fromEnv = process.env.APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, "");

  const h = await headers();
  const origin = h.get("origin");
  if (origin && origin !== "null") return origin.replace(/\/+$/, "");
  const host = h.get("x-forwarded-host") ?? h.get("host");
  return `${h.get("x-forwarded-proto") ?? "https"}://${host}`;
}
