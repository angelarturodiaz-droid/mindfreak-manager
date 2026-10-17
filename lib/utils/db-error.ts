/**
 * Mensajes de la base que ya vienen en español con un código delante
 * ("issued_invoice_locked: la factura ya fue emitida…"): se quita el código
 * para mostrarlo al usuario. Los demás errores pasan igual.
 */
const CODED = ["issued_invoice_locked", "locked_quotation"];

export function dbErrorMessage(message: string): string {
  for (const code of CODED) {
    const i = message.indexOf(`${code}:`);
    if (i >= 0) {
      const text = message.slice(i + code.length + 1).trim();
      return text.charAt(0).toUpperCase() + text.slice(1);
    }
  }
  return message;
}
