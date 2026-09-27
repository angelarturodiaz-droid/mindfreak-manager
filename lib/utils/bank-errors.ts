/**
 * Errores de las reglas de cuentas (migración 063, trigger
 * check_bank_transaction_funds). La base de datos devuelve
 * "codigo: mensaje para el usuario"; aquí se separa el código del mensaje.
 *
 * - insufficient_funds / credit_insufficient → error para mostrar tal cual.
 * - overdraft_confirmation_required → no es un error: la pantalla debe
 *   preguntar Continuar / Cancelar y reenviar con confirm_overdraft=1.
 */
export type BankRuleResult =
  | { kind: "error"; message: string }
  | { kind: "confirm"; message: string };

const CODES = ["insufficient_funds", "credit_insufficient", "overdraft_confirmation_required"] as const;

export function parseBankRuleError(message: string | null | undefined): BankRuleResult | null {
  if (!message) return null;
  for (const code of CODES) {
    const idx = message.indexOf(`${code}:`);
    if (idx >= 0) {
      const text = message.slice(idx + code.length + 1).trim();
      return code === "overdraft_confirmation_required"
        ? { kind: "confirm", message: text }
        : { kind: "error", message: text };
    }
  }
  return null;
}

/** Convierte el error de Supabase en el estado de un formulario con confirmación de sobregiro. */
export function bankRuleState(message: string): { error: string | null; confirmOverdraft?: string } | null {
  const rule = parseBankRuleError(message);
  if (!rule) return null;
  return rule.kind === "confirm"
    ? { error: null, confirmOverdraft: rule.message }
    : { error: rule.message };
}

/** true si el formulario se reenvió después de que el usuario confirmó el sobregiro. */
export function overdraftConfirmed(formData: FormData): boolean {
  return formData.get("confirm_overdraft") === "1";
}
