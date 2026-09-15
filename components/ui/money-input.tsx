"use client";

import { useId, useState } from "react";
import { FIELD_CLASSES } from "./field";

function sanitize(input: string): string {
  let cleaned = input.replace(/[^\d.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot !== -1) {
    cleaned = cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, "");
  }
  return cleaned;
}

function formatWithCommas(raw: string): string {
  if (!raw) return "";
  const [intPart, decPart] = raw.split(".");
  const formattedInt = (intPart || "0").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decPart !== undefined ? `${formattedInt}.${decPart}` : formattedInt;
}

/**
 * Input de dinero/cantidades: muestra separador de miles (comas) mientras
 * se escribe, pero envía el valor numérico real (sin comas) en el submit
 * del formulario vía un input oculto con el mismo `name` — el servidor no
 * necesita cambiar nada.
 */
export function MoneyInput({
  label,
  name,
  defaultValue = 0,
  required,
  min,
  disabled,
  className = "",
  hint,
}: {
  label?: string;
  name: string;
  defaultValue?: number | string;
  required?: boolean;
  min?: number;
  disabled?: boolean;
  className?: string;
  hint?: string;
}) {
  const autoId = useId();
  const [raw, setRaw] = useState(() => sanitize(String(defaultValue ?? "")));

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={autoId} className="text-sm font-medium text-brand-text">
          {label}
          {required && <span className="text-brand-danger"> *</span>}
        </label>
      )}
      <input
        id={autoId}
        type="text"
        inputMode="decimal"
        value={formatWithCommas(raw)}
        onChange={(e) => setRaw(sanitize(e.target.value))}
        disabled={disabled}
        className={`${FIELD_CLASSES} ${className} ${disabled ? "cursor-not-allowed bg-brand-background text-brand-disabled" : ""}`}
      />
      <input type="hidden" name={name} value={raw} required={required} min={min} />
      {hint && <p className="text-xs text-brand-muted">{hint}</p>}
    </div>
  );
}
