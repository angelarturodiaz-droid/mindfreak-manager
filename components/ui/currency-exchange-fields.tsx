"use client";

import { useState } from "react";
import { Select, Input } from "./field";
import { rateOn, type RateHistory } from "@/components/payments/foreign-payment-block";
import { RATE_SOURCE_LABELS, type RateSource } from "@/features/currencies/schema";
import { todayISO } from "@/lib/utils/dates";

/**
 * Moneda del documento (cotización, factura o gasto). Por defecto la moneda
 * funcional de la empresa. La tasa de cambio solo se pide cuando la moneda
 * elegida es distinta a la funcional; si coinciden se envía 1 con un input
 * oculto.
 *
 * Multimoneda V5: al elegir otra moneda, la tasa se llena sola con la tasa
 * de referencia del día (Configuración → Monedas y tasas) y se puede
 * cambiar. Al editar un documento que ya estaba en esa moneda se conserva
 * su tasa.
 */
export function CurrencyExchangeFields({
  baseCurrency,
  currencies,
  defaultCurrency,
  defaultExchangeRate = 1,
  rates = {},
}: {
  baseCurrency: string;
  /** Monedas activas del catálogo (Configuración → Monedas y tasas). */
  currencies: string[];
  defaultCurrency?: string;
  defaultExchangeRate?: number;
  /** Tasas de referencia registradas, por moneda (para llenar la tasa sola). */
  rates?: RateHistory;
}) {
  const initial = defaultCurrency ?? baseCurrency;
  const [currency, setCurrency] = useState(initial);
  // null = el usuario no la escribió: se usa la del documento o la del día.
  const [typed, setTyped] = useState<string | null>(null);
  const needsRate = currency !== baseCurrency;

  const keepDocRate = defaultCurrency !== undefined && currency === defaultCurrency && defaultCurrency !== baseCurrency;
  const found = needsRate ? rateOn(rates, currency, todayISO()) : null;
  const suggested = keepDocRate ? String(defaultExchangeRate) : found ? String(found.rate) : "";
  const value = typed ?? suggested;

  const hint = keepDocRate
    ? `1 ${currency} = ? ${baseCurrency} · tasa guardada en el documento`
    : found
      ? `Tasa del día: ${RATE_SOURCE_LABELS[found.source as RateSource] ?? found.source} · ${found.date}${typed !== null && Number(typed) !== found.rate ? " · cambiada a mano" : ". Puedes cambiarla."}`
      : `No hay tasa de ${currency} registrada: escríbela (1 ${currency} = ? ${baseCurrency}).`;

  return (
    <div className="flex gap-3">
      <Select
        label="Moneda"
        name="currency"
        value={currency}
        onChange={(e) => {
          setCurrency(e.target.value);
          setTyped(null);
        }}
        className="flex-1"
        hint={currency === baseCurrency ? "Moneda de la empresa (por defecto)." : undefined}
      >
        {Array.from(new Set([baseCurrency, ...currencies, ...(defaultCurrency ? [defaultCurrency] : [])])).map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </Select>
      {needsRate ? (
        <Input
          label={`Tasa de cambio (1 ${currency} = ? ${baseCurrency})`}
          name="exchange_rate"
          type="number"
          step="0.000001"
          value={value}
          onChange={(e) => setTyped(e.target.value)}
          hint={hint}
          info={`Cuántos ${baseCurrency} vale 1 ${currency} para este documento. Se llena con la tasa de referencia del día (Configuración → Monedas y tasas) y la puedes cambiar.`}
          className="flex-1"
        />
      ) : (
        <input type="hidden" name="exchange_rate" value="1" />
      )}
    </div>
  );
}
