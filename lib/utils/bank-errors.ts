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

const CODES = ["insufficient_funds", "credit_insufficient", "overdraft_confirmation_required", "currency_mismatch"] as const;

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

/**
 * Estado de los formularios que mueven dinero (ver useOverdraftConfirmAction):
 * error en línea, sobregiro por confirmar, bloqueo o éxito (ventanas emergentes).
 */
export type MoneyActionState = {
  error: string | null;
  confirmOverdraft?: string;
  blocked?: string;
  blockedTitle?: string;
  success?: string;
  successTitle?: string;
  successId?: number;
  /** Campo o grupo de campos con el problema (ej. "fx" = falta la tasa o el monto del banco), para marcarlo en rojo. */
  field?: string;
};

/** Título de la ventana según el mensaje de la base de datos. */
const TITLES = ["Fondos insuficientes", "Crédito insuficiente", "Moneda diferente"];

/**
 * Convierte el error de Supabase en el estado de un formulario: sobregiro
 * por confirmar (`confirmOverdraft`) o bloqueo para mostrar en una ventana
 * (`blocked` + `blockedTitle`).
 */
export function bankRuleState(
  message: string,
): { error: string | null; confirmOverdraft?: string; blocked?: string; blockedTitle?: string } | null {
  const rule = parseBankRuleError(message);
  if (!rule) return null;
  if (rule.kind === "confirm") return { error: null, confirmOverdraft: rule.message };
  const title = TITLES.find((t) => rule.message.startsWith(t));
  // "Fondos insuficientes. La cuenta…" → título aparte y el resto como detalle.
  const body = title ? rule.message.slice(title.length).replace(/^[.:\s]+/, "") : rule.message;
  return { error: null, blocked: body || rule.message, blockedTitle: title ?? "Operación no permitida" };
}

/** true si el formulario se reenvió después de que el usuario confirmó el sobregiro. */
export function overdraftConfirmed(formData: FormData): boolean {
  return formData.get("confirm_overdraft") === "1";
}

/**
 * Error de validación del formulario (zod) como estado de la pantalla. Si
 * lo que falta es la tasa de cambio del documento, además del texto en rojo
 * abre la ventana roja "Falta un dato" y marca el campo (`field: "rate"`).
 */
export function validationErrorState(issues: { message: string; path: PropertyKey[] }[]): MoneyActionState {
  const issue = issues[0];
  const msg = issue?.message ?? "Datos inválidos.";
  if (issue?.path[0] === "exchange_rate") {
    return { error: msg, blockedTitle: "Falta un dato", blocked: msg, field: "rate" };
  }
  return { error: msg };
}
