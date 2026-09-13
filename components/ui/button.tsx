import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "icon";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-brand-primary text-white hover:bg-brand-primary-hover disabled:bg-brand-disabled",
  secondary:
    "bg-brand-accent text-white hover:bg-brand-accent-hover disabled:bg-brand-disabled",
  outline:
    "border border-brand-border bg-brand-surface text-brand-text hover:bg-brand-surface-hover disabled:text-brand-disabled",
  ghost:
    "text-brand-muted hover:bg-brand-surface-hover hover:text-brand-text disabled:text-brand-disabled",
  danger:
    "bg-brand-danger text-white hover:opacity-90 disabled:bg-brand-disabled",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "px-2.5 py-1.5 text-xs gap-1.5",
  md: "px-4 py-2 text-sm gap-2",
  icon: "h-8 w-8 p-0 justify-center",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", icon, loading, disabled, className = "", children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`inline-flex items-center rounded-[var(--radius-md)] font-medium shadow-[var(--shadow-sm)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:shadow-none ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...props}
    >
      {loading ? (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
          />
        </svg>
      ) : (
        icon
      )}
      {children}
    </button>
  );
});
