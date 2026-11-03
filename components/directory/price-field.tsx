"use client";

import { useId, useRef, useState } from "react";
import { FIELD_CLASSES, FieldWrapper } from "@/components/ui/field";
import { detectPriceCurrency, formatPriceText, type PriceCurrency } from "@/features/directory/schema";

/**
 * Precio de referencia con su moneda (pesos o dólares). Es solo informativo: no crea gastos,
 * no cambia saldos ni la moneda de los gastos que se le registren después.
 */
export function PriceField({
  defaultValue,
  disabled,
  label = "Precio de referencia",
}: {
  defaultValue?: string | null;
  disabled?: boolean;
  label?: string;
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [currency, setCurrency] = useState<PriceCurrency>(detectPriceCurrency(defaultValue));

  return (
    <FieldWrapper
      label={label}
      htmlFor={id}
      info="Lo que nos dijeron que cobra, en pesos (RD$) o en dólares (US$). Al salir del campo los números se ponen con comas y punto (15000 → RD$15,000.00). Es solo una referencia: no crea ningún gasto ni cambia saldos; la moneda de cada gasto se elige en el gasto."
    >
      <div className="flex gap-2">
        <select
          name="price_currency"
          aria-label="Moneda del precio"
          title="Moneda del precio de referencia"
          value={currency}
          disabled={disabled}
          onChange={(e) => {
            const next = e.currentTarget.value as PriceCurrency;
            setCurrency(next);
            if (inputRef.current) inputRef.current.value = formatPriceText(inputRef.current.value, next);
          }}
          className={`${FIELD_CLASSES.replace("w-full ", "")} w-[5.5rem] shrink-0 px-2`}
        >
          <option value="DOP">RD$</option>
          <option value="USD">US$</option>
        </select>
        <input
          ref={inputRef}
          id={id}
          name="reference_price"
          defaultValue={formatPriceText(defaultValue, detectPriceCurrency(defaultValue))}
          disabled={disabled}
          placeholder={currency === "USD" ? "Ej. desde US$500 por hora" : "Ej. desde RD$15,000 por hora"}
          onBlur={(e) => {
            e.currentTarget.value = formatPriceText(e.currentTarget.value, currency);
          }}
          className={`${FIELD_CLASSES} min-w-0 flex-1`}
        />
      </div>
    </FieldWrapper>
  );
}
