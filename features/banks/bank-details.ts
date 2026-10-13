import { ACCOUNT_KIND_LABELS } from "./schema";

/**
 * "Datos bancarios para el pago" (migración 082): copia congelada, en la
 * factura o cotización, de las cuentas donde el cliente puede pagar. Si
 * después se edita la cuenta en Bancos, el documento ya hecho no cambia
 * (se actualiza solo al volver a guardar sus cuentas). Es informativo: no
 * toca montos, impuestos ni cobros.
 */
export type BankDetail = {
  bank_account_id: string;
  account_name: string;
  bank_name: string | null;
  number: string | null;
  /** "Ahorros" / "Corriente" (null si la cuenta no tiene tipo). */
  kind_label: string | null;
  currency: string;
  holder: string | null;
  tax_id: string | null;
};

/** Cuenta que se puede elegir (Bancos → "Mostrar en facturas"). */
export type BankDetailOption = {
  id: string;
  name: string;
  bank_name: string | null;
  account_number_masked: string | null;
  account_kind: string | null;
  currency: string;
  holder_name: string | null;
};

export const BANK_DETAIL_OPTION_COLUMNS =
  "id, name, bank_name, account_number_masked, account_kind, currency, holder_name";

/** Lee el jsonb de la base de forma segura (siempre devuelve un arreglo). */
export function parseBankDetails(value: unknown): BankDetail[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (v): v is BankDetail =>
      Boolean(v) && typeof v === "object" && typeof (v as BankDetail).bank_account_id === "string",
  );
}

/** Cuentas sugeridas: las marcadas para facturas en la moneda del documento. */
export function suggestedAccountIds(options: BankDetailOption[], currency: string): string[] {
  return options.filter((o) => o.currency === currency).map((o) => o.id);
}

/** Arma la copia congelada a partir de las cuentas elegidas y la empresa. */
export function toBankDetails(
  options: BankDetailOption[],
  company: { name: string | null; legal_name: string | null; tax_id: string | null } | null,
): BankDetail[] {
  const companyHolder = company?.legal_name || company?.name || null;
  return options.map((o) => ({
    bank_account_id: o.id,
    account_name: o.name,
    bank_name: o.bank_name,
    number: o.account_number_masked,
    kind_label: o.account_kind ? ACCOUNT_KIND_LABELS[o.account_kind] ?? null : null,
    currency: o.currency,
    // Titular propio de la cuenta (si es otro) o el nombre legal de la empresa.
    holder: o.holder_name || companyHolder,
    // El RNC solo se pone cuando el titular es la empresa.
    tax_id: o.holder_name ? null : company?.tax_id ?? null,
  }));
}
