"use client";

import { useState } from "react";
import { Select, Input } from "./field";

/**
 * La tasa de cambio solo tiene sentido cuando la moneda elegida es
 * distinta a la moneda base de la empresa (configurable en Configuración
 * → Organización) — si coinciden, no hay conversión que hacer, se envía
 * 1 automáticamente vía un input oculto.
 */
export function CurrencyExchangeFields({
  baseCurrency,
  currencies,
  defaultCurrency,
  defaultExchangeRate = 1,
}: {
  baseCurrency: string;
  /** Monedas activas del catálogo (Configuración → Monedas y tasas). */
  currencies: string[];
  defaultCurrency?: string;
  defaultExchangeRate?: number;
}) {
  const [currency, setCurrency] = useState(defaultCurrency ?? baseCurrency);
  const needsRate = currency !== baseCurrency;

  return (
    <div className="flex gap-3">
      <Select
        label="Moneda"
        name="currency"
        defaultValue={defaultCurrency ?? baseCurrency}
        onChange={(e) => setCurrency(e.target.value)}
        className="flex-1"
      >
        {Array.from(new Set([baseCurrency, ...currencies, ...(defaultCurrency ? [defaultCurrency] : [])])).map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </Select>
      {needsRate ? (
        <Input
          label="Tasa de cambio"
          name="exchange_rate"
          type="number"
          step="0.000001"
          min="0.000001"
          required
          defaultValue={defaultExchangeRate}
          hint={`1 ${currency} = ? ${baseCurrency}`}
          info={`Cuántos ${baseCurrency} vale 1 ${currency} para este documento. Las tasas de referencia del día están en Configuración → Monedas y tasas.`}
          className="flex-1"
        />
      ) : (
        <input type="hidden" name="exchange_rate" value="1" />
      )}
    </div>
  );
}
