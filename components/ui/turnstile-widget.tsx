"use client";

import Script from "next/script";

/**
 * Widget de Cloudflare Turnstile ("no soy un robot"). Se muestra solo cuando
 * el servidor detecta comportamiento sospechoso (varios logins fallidos
 * seguidos con el mismo correo — ver features/auth/actions.ts).
 *
 * Al vivir dentro de un <form>, Turnstile agrega automáticamente un input
 * oculto `cf-turnstile-response` con el token — no hace falta JS adicional
 * para leerlo, el Server Action lo recibe directo en el FormData.
 *
 * Requiere la variable de entorno pública NEXT_PUBLIC_TURNSTILE_SITE_KEY
 * (ver .env.example). Si no está configurada, no se renderiza nada — así
 * el login sigue funcionando mientras se configura el captcha.
 */
export function TurnstileWidget() {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!siteKey) return null;

  return (
    <div className="flex flex-col gap-1">
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
      <div className="cf-turnstile" data-sitekey={siteKey} data-theme="light" />
    </div>
  );
}
