import type { ReactNode } from "react";

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
}: {
  label: string;
  value: string;
  /** Ej. "+12.4%" o "-3.1%" respecto al período anterior */
  trend?: string;
  danger?: boolean;
  icon?: ReactNode;
}) {
  const trendPositive = trend?.startsWith("+");
  return (
    <Card className="flex h-full flex-col gap-3 transition-shadow hover:shadow-[var(--shadow-md)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-brand-muted">{label}</p>
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
        className={`text-2xl font-semibold tracking-tight ${danger ? "text-brand-danger" : "text-brand-text"}`}
      >
        {value}
      </p>
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
