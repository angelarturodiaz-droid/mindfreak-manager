"use client";

import { useState } from "react";
import { Select } from "@/components/ui/field";

export type PickerAccount = {
  id: string;
  name: string;
  bank_name: string | null;
  currency: string;
  /** BANK o CREDIT_CARD. Sin dato se toma como cuenta de banco. */
  type?: string | null;
};

/**
 * Selector de la cuenta (o tarjeta) desde/hacia donde se mueve el dinero.
 *
 * - `kind` decide qué se lista: "card" = solo tarjetas de crédito; "bank" =
 *   solo cuentas de banco. Lo decide el Método de pago del formulario.
 * - Filtro de **moneda** debajo de la lista: arranca en la moneda del
 *   documento (gasto o factura) para no pagar por error desde una cuenta en
 *   otra moneda; se cambia a "Todas" u otra moneda a propósito.
 */
export function AccountPicker({
  accounts,
  kind,
  documentCurrency,
  value,
  onChange,
  name = "bank_account_id",
  label,
  required = true,
  emptyOptionLabel,
  hint,
}: {
  accounts: PickerAccount[];
  kind: "bank" | "card";
  documentCurrency: string;
  value: string;
  onChange: (id: string) => void;
  name?: string;
  label?: string;
  required?: boolean;
  /** Opción vacía seleccionable (ej. "Aún no lo sé — queda pendiente"). Sin ella, la opción vacía es solo un aviso. */
  emptyOptionLabel?: string;
  hint?: string;
}) {
  const ofKind = accounts.filter((a) => (kind === "card" ? a.type === "CREDIT_CARD" : a.type !== "CREDIT_CARD"));
  const currencies = Array.from(new Set(ofKind.map((a) => a.currency))).sort((a, b) =>
    a === documentCurrency ? -1 : b === documentCurrency ? 1 : a.localeCompare(b),
  );
  // Moneda elegida en el filtro; null = la del documento (si hay cuentas en ella) o todas.
  const [picked, setPicked] = useState<string | null>(null);
  const defaultFilter = currencies.includes(documentCurrency) ? documentCurrency : "ALL";
  const filter = picked ?? defaultFilter;
  const shown = ofKind.filter((a) => filter === "ALL" || a.currency === filter);
  const noun = kind === "card" ? "tarjeta" : "cuenta";

  return (
    <div className="flex flex-col gap-1">
      <Select
        label={label ?? (kind === "card" ? "Tarjeta de crédito" : "Cuenta bancaria")}
        name={name}
        // Sin "required" del navegador (sale en inglés): si falta, el servidor
        // responde "Elige la cuenta o tarjeta…" en español.
        aria-required={required && !emptyOptionLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        hint={
          hint ??
          (ofKind.length === 0
            ? kind === "card"
              ? "No tienes tarjetas de crédito activas. Créala en Bancos → Nueva cuenta o tarjeta."
              : "No tienes cuentas de banco activas."
            : undefined)
        }
      >
        {emptyOptionLabel ? (
          <option value="">{emptyOptionLabel}</option>
        ) : (
          <option value="" disabled>
            {kind === "card" ? "Selecciona una tarjeta…" : "Selecciona una cuenta…"}
          </option>
        )}
        {shown.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
            {a.bank_name ? ` (${a.bank_name})` : ""} · {a.currency}
          </option>
        ))}
      </Select>
      {currencies.length > 1 && (
        <div className="flex items-center gap-1 text-xs" role="group" aria-label={`Moneda de la ${noun}`}>
          <span className="text-brand-muted">Ver moneda:</span>
          {[...currencies, "ALL"].map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                setPicked(c);
                // Si la elegida ya no está en la lista, se limpia.
                const still = ofKind.find((a) => a.id === value && (c === "ALL" || a.currency === c));
                if (value && !still) onChange("");
              }}
              className={`rounded-full border px-2 py-0.5 ${
                filter === c
                  ? "border-brand-accent bg-brand-accent-light font-medium text-brand-accent"
                  : "border-brand-border text-brand-muted hover:text-brand-text"
              }`}
              title={
                c === "ALL"
                  ? `Ver todas las ${noun === "tarjeta" ? "tarjetas" : "cuentas"}`
                  : c === documentCurrency
                    ? `Solo ${noun === "tarjeta" ? "tarjetas" : "cuentas"} en ${c} (la moneda del documento)`
                    : `Solo ${noun === "tarjeta" ? "tarjetas" : "cuentas"} en ${c}: pedirá cuánto se movió realmente y la tasa`
              }
            >
              {c === "ALL" ? "Todas" : c}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
