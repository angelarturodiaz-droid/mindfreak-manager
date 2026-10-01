/**
 * Correo de la encuesta de satisfacción, con el branding de la empresa
 * (banda oscura, logo, botón con el color de acento). HTML con tablas y
 * estilos en línea para que se vea bien en Gmail, Outlook y el celular.
 */

function esc(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function surveyEmailHtml(params: {
  companyName: string;
  logoUrl: string | null;
  brandPrimary: string | null;
  brandAccent: string | null;
  recipientName: string | null;
  projectName: string;
  eventDate: string | null;
  message: string;
  link: string;
  isReminder?: boolean;
}): string {
  const dark = !params.brandPrimary || params.brandPrimary.toLowerCase() === "#000000" ? "#141b20" : params.brandPrimary;
  const accent = params.brandAccent || "#17a6b8";
  const hello = params.recipientName ? `Hola ${esc(params.recipientName.split(" ")[0])},` : "Hola,";
  const date = params.eventDate
    ? new Intl.DateTimeFormat("es-DO", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
        new Date(`${params.eventDate}T00:00:00Z`),
      )
    : null;
  const logo = params.logoUrl
    ? `<img src="${esc(params.logoUrl)}" alt="${esc(params.companyName)}" width="44" height="44" style="display:block;width:44px;height:44px;border-radius:22px;background:#ffffff;object-fit:contain;border:2px solid ${accent};" />`
    : `<div style="width:44px;height:44px;border-radius:22px;background:#ffffff;border:2px solid ${accent};color:${dark};font:700 20px/44px Arial,sans-serif;text-align:center;">${esc(params.companyName.charAt(0))}</div>`;

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(params.companyName)}</title></head>
<body style="margin:0;padding:0;background:#f2f4f7;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f4f7;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:#1b2327;">
  <tr><td style="height:4px;background:${accent};font-size:0;line-height:0;">&nbsp;</td></tr>
  <tr><td style="background:${dark};padding:20px 24px;">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td style="padding-right:12px;">${logo}</td>
      <td style="color:#ffffff;font-size:17px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">${esc(params.companyName)}</td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:28px 24px 8px;">
    <p style="margin:0 0 6px;color:${accent};font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">${params.isReminder ? "Recordatorio · " : ""}Encuesta de satisfacción</p>
    <p style="margin:0 0 16px;font-size:20px;font-weight:700;line-height:1.3;">${hello}</p>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#344054;">${esc(params.message)}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f9fa;border-radius:10px;margin:0 0 22px;">
      <tr><td style="padding:14px 16px;font-size:14px;line-height:1.5;">
        <span style="color:#667085;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Evento</span><br>
        <strong>${esc(params.projectName)}</strong>${date ? `<br><span style="color:#667085;">${esc(date)}</span>` : ""}
      </td></tr>
    </table>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 22px;"><tr>
      <td style="border-radius:10px;background:${accent};">
        <a href="${esc(params.link)}" style="display:inline-block;padding:14px 28px;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;border-radius:10px;">Responder encuesta</a>
      </td>
    </tr></table>
    <p style="margin:0 0 6px;font-size:12px;color:#667085;line-height:1.5;">Te tomará menos de 2 minutos. Si el botón no funciona, copia este enlace en tu navegador:</p>
    <p style="margin:0 0 24px;font-size:12px;line-height:1.5;word-break:break-all;"><a href="${esc(params.link)}" style="color:${accent};">${esc(params.link)}</a></p>
  </td></tr>
  <tr><td style="background:${dark};padding:14px 24px;color:#aeb9bf;font-size:12px;">${esc(params.companyName)} · Gracias por confiar en nosotros.</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}
