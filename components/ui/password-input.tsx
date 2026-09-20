"use client";

import { forwardRef, useId, useState } from "react";
import type { InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { FIELD_CLASSES, FieldWrapper } from "./field";

export interface PasswordInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  error?: string;
  hint?: string;
  /** Ícono decorativo a la izquierda del campo (ej. candado para "Contraseña"). */
  icon?: React.ReactNode;
}

/**
 * Igual que <Input type="password" />, pero con un botón de "ojito" para
 * mostrar/ocultar el texto mientras se escribe.
 */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ label, error, hint, id, className = "", required, icon, ...props }, ref) {
    const autoId = useId();
    const inputId = id ?? autoId;
    const [visible, setVisible] = useState(false);

    return (
      <FieldWrapper label={label} htmlFor={inputId} error={error} hint={hint} required={required}>
        <div className="relative flex items-center">
          {icon && <span className="pointer-events-none absolute left-3 flex text-brand-muted">{icon}</span>}
          <input
            ref={ref}
            id={inputId}
            type={visible ? "text" : "password"}
            required={required}
            className={`${FIELD_CLASSES} ${icon ? "pl-10" : ""} pr-9 ${error ? "border-brand-danger" : ""} ${className}`}
            {...props}
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-brand-muted hover:text-brand-text"
          >
            {visible ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </FieldWrapper>
    );
  },
);
