/**
 * Correo de recordatorio de factura (motor de recordatorios, prueba BE).
 * Mismo estilo que el correo de la encuesta: banda oscura con logo, resumen
 * de la factura y los "Datos bancarios para el pago" que tiene la factura.
 * HTML con tablas y estilos en línea (Gmail, Outlook, celular).
 */
import type { BankDetail } from "@/features/banks/bank-details";

function esc(s: string): string {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export function invoiceReminderEmailHtml(params: {
  companyName: string;
  logoUrl: string | null;
  brandPrimary: string | null;
  brandAccent: string | null;
  recipientName: string | null;
  invoiceNumber: string;
  balanceText: string;
  totalText: string;
  dueText: string;
  overdue: boolean;
  message: string;
  bankDetails: BankDetail[];
}): string {
  const dark = !params.brandPrimary || params.brandPrimary.toLowerCase() === "#000000" ? "#141b20" : params.brandPrimary;
  const accent = params.brandAccent || "#17a6b8";
  const hello = params.recipientName ? `Hola ${esc(params.recipientName.split(" ")[0])},` : "Hola,";
  const logo = params.logoUrl
    ? `<img src="${esc(params.logoUrl)}" alt="${esc(params.companyName)}" width="44" height="44" style="display:block;width:44px;height:44px;border-radius:22px;background:#ffffff;object-fit:contain;border:2px solid ${accent};" />`
    : `<div style="width:44px;height:44px;border-radius:22px;background:#ffffff;border:2px solid ${accent};color:${dark};font:700 20px/44px Arial,sans-serif;text-align:center;">${esc(params.companyName.charAt(0))}</div>`;
  const dueColor = params.overdue ? "#d92d20" : "#344054";

  const banks = params.bankDetails.length
    ? `<p style="margin:0 0 8px;color:#667085;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Datos bancarios para el pago</p>
    ${params.bankDetails
      .map(
        (b) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e4e7ec;border-radius:10px;margin:0 0 8px;">
      <tr><td style="padding:10px 14px;font-size:13px;line-height:1.55;color:#344054;">
        <strong>${esc(b.bank_name ?? b.account_name)}</strong> · ${esc(b.currency)}${b.kind_label ? ` · ${esc(b.kind_label)}` : ""}<br>
        ${b.number ? `Cuenta: <strong>${esc(b.number)}</strong><br>` : ""}
        ${b.holder ? `Titular: ${esc(b.holder)}${b.tax_id ? ` · RNC ${esc(b.tax_id)}` : ""}` : ""}
      </td></tr>
    </table>`,
      )
      .join("")}`
    : "";

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
    <p style="margin:0 0 6px;color:${accent};font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Recordatorio de pago</p>
    <p style="margin:0 0 16px;font-size:20px;font-weight:700;line-height:1.3;">${hello}</p>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#344054;">${esc(params.message)}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f9fa;border-radius:10px;margin:0 0 22px;">
      <tr><td style="padding:14px 16px;font-size:14px;line-height:1.6;">
        <span style="color:#667085;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Factura</span><br>
        <strong style="font-size:16px;">${esc(params.invoiceNumber)}</strong><br>
        <span style="color:#667085;">Total ${esc(params.totalText)}</span><br>
        <span>Pendiente: <strong style="font-size:16px;">${esc(params.balanceText)}</strong></span><br>
        <span style="color:${dueColor};font-weight:700;">${esc(params.dueText)}</span>
      </td></tr>
    </table>
    ${banks}
    <p style="margin:14px 0 24px;font-size:12px;color:#667085;line-height:1.5;">Para cualquier duda, responde a este correo.</p>
  </td></tr>
  <tr><td style="background:${dark};padding:14px 24px;color:#aeb9bf;font-size:12px;">${esc(params.companyName)} · Gracias por confiar en nosotros.</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}
