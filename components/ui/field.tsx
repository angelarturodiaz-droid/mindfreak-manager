import { forwardRef, useId } from "react";
import type { InputHTMLAttributes, SelectHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

export const FIELD_CLASSES =
  "w-full rounded-[var(--radius-md)] border border-brand-border bg-brand-surface px-3 py-2.5 text-sm text-brand-text outline-none transition-colors placeholder:text-brand-muted hover:border-brand-muted focus:border-brand-accent focus:ring-2 focus:ring-brand-accent-light disabled:cursor-not-allowed disabled:border-brand-border disabled:bg-brand-background disabled:text-brand-disabled disabled:hover:border-brand-border";

export function FieldWrapper({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
}: {
  label?: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={htmlFor} className="text-sm font-medium text-brand-text">
          {label}
          {required && <span className="text-brand-danger"> *</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-xs text-brand-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-brand-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  /** Ícono decorativo a la izquierda del campo (ej. sobre para "Correo"). */
  icon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, id, className = "", required, icon, ...props },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const input = (
    <input
      ref={ref}
      id={inputId}
      required={required}
      className={`${FIELD_CLASSES} ${icon ? "pl-10" : ""} ${error ? "border-brand-danger" : ""} ${className}`}
      {...props}
    />
  );
  return (
    <FieldWrapper label={label} htmlFor={inputId} error={error} hint={hint} required={required}>
      {icon ? (
        <div className="relative flex items-center">
          <span className="pointer-events-none absolute left-3 flex text-brand-muted">{icon}</span>
          {input}
        </div>
      ) : (
        input
      )}
    </FieldWrapper>
  );
});

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, hint, id, className = "", required, children, ...props },
  ref,
) {
  const autoId = useId();
  const selectId = id ?? autoId;
  return (
    <FieldWrapper label={label} htmlFor={selectId} error={error} hint={hint} required={required}>
      <select
        ref={ref}
        id={selectId}
        required={required}
        className={`${FIELD_CLASSES} ${error ? "border-brand-danger" : ""} ${className}`}
        {...props}
      >
        {children}
      </select>
    </FieldWrapper>
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, hint, id, className = "", required, ...props },
  ref,
) {
  const autoId = useId();
  const textareaId = id ?? autoId;
  return (
    <FieldWrapper label={label} htmlFor={textareaId} error={error} hint={hint} required={required}>
      <textarea
        ref={ref}
        id={textareaId}
        required={required}
        className={`${FIELD_CLASSES} resize-y ${error ? "border-brand-danger" : ""} ${className}`}
        {...props}
      />
    </FieldWrapper>
  );
});
