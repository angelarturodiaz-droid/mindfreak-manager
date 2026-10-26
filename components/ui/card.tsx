import type { ReactNode } from "react";
import { InfoHint } from "./info-hint";

export function Card({
  children,
  className = "",
  padded = true,
  id,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
  id?: string;
}) {
  return (
    <div
      id={id}
      className={`rounded-[var(--radius-lg)] border border-brand-border bg-brand-surface shadow-[var(--shadow-sm)] ${
        padded ? "p-5" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

export function KpiCard({
  label,
  value,
  trend,
  danger,
  icon,
  hint,
  info,
}: {
  label: string;
  value: string;
  /** Explicación al pasar el mouse por la ⓘ junto al título. */
  info?: string;
  /** Texto chico debajo del valor (ej. desglose). */
  hint?: ReactNode;
  /** Ej. "+12.4%" o "-3.1%" respecto al período anterior */
  trend?: string;
  danger?: boolean;
  icon?: ReactNode;
}) {
  const trendPositive = trend?.startsWith("+");
  return (
    <Card className="@container flex h-full min-w-0 flex-col gap-3 transition-shadow hover:shadow-[var(--shadow-md)]">
      <div className="flex items-start justify-between gap-3">
        <p className="flex items-center gap-1 text-sm font-medium text-brand-muted">
          {label}
          {info && <InfoHint text={info} />}
        </p>
        {icon && (
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] ${
              danger
                ? "bg-brand-danger-bg text-brand-danger"
                : "bg-brand-accent-light text-brand-accent"
            }`}
          >
            {icon}
          </span>
        )}
      </div>
      <p
        className={`whitespace-nowrap text-base font-semibold tracking-tight tabular-nums @[12rem]:text-lg @[14rem]:text-xl @[18rem]:text-2xl ${danger ? "text-brand-danger" : "text-brand-text"}`}
      >
        {value}
      </p>
      {hint && <p className="-mt-2 text-xs text-brand-muted">{hint}</p>}
      {trend && (
        <p
          className={`text-xs font-medium ${
            trendPositive ? "text-brand-success" : "text-brand-danger"
          }`}
        >
          {trend} vs. período anterior
        </p>
      )}
    </Card>
  );
}
