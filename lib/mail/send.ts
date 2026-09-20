import nodemailer from "nodemailer";

/**
 * Envío directo de correo, independiente del mailer de Supabase Auth.
 *
 * Por qué existe: la API de administración de Supabase (adminClient.auth.
 * admin.updateUserById) NO dispara los correos de notificación de
 * seguridad de Supabase (ej. "Email address changed") — esa lógica solo
 * corre cuando el propio usuario cambia sus datos con su sesión
 * (supabase.auth.updateUser). Confirmado revisando los logs de Auth: al
 * cambiar el correo de un usuario vía admin, no hay ningún intento de
 * envío, con o sin la notificación de seguridad activada en el
 * dashboard. Ver CHANGELOG.md.
 *
 * Por eso, para correos que SÍ tienen que llegar cuando actúa un admin
 * (ej. avisar al correo anterior de un usuario que su correo cambió),
 * esta app manda el correo directo por su cuenta, vía SMTP genérico —
 * funciona igual con el SMTP de Hostinger (rápido de configurar hoy) o
 * con un proveedor transaccional dedicado como Resend/SendGrid/SES
 * (mejor práctica a futuro) con solo cambiar las variables de entorno,
 * sin tocar código.
 *
 * Variables de entorno requeridas (.env.local — NUNCA subir a git):
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD
 * Opcional: SMTP_FROM (si no se define, usa SMTP_USER).
 */

let cachedTransporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;

  if (!host || !port || !user || !password) return null;

  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host,
      port: Number(port),
      secure: Number(port) === 465,
      auth: { user, pass: password },
    });
  }
  return cachedTransporter;
}

/**
 * Manda un correo. Devuelve `true` si se envió, `false` si no está
 * configurado el SMTP o si falló — nunca lanza excepción, para que un
 * problema de correo no tumbe la acción que lo dispara (el cambio en la
 * base de datos ya se aplicó antes de llegar aquí en todos los casos de
 * uso actuales).
 */
export async function sendMail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  const transporter = getTransporter();
  if (!transporter) {
    console.error(
      "sendMail: SMTP no configurado (faltan SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASSWORD en .env.local) — no se envió el correo a",
      to,
    );
    return false;
  }

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      html,
    });
    return true;
  } catch (e) {
    console.error("sendMail: error enviando correo a", to, e);
    return false;
  }
}
