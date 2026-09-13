import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div
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
    <Card className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-sm text-brand-muted">{label}</p>
        {icon && <span className="text-brand-muted">{icon}</span>}
      </div>
      <p
        className={`text-2xl font-semibold ${danger ? "text-brand-danger" : "text-brand-text"}`}
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
