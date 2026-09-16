import type { ReactNode } from "react";

export function SecurityRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-brand-border py-4 last:border-0">
      <p className="w-40 shrink-0 text-sm font-medium text-brand-text">{label}</p>
      <div className="flex-1 text-sm text-brand-text">{children}</div>
    </div>
  );
}

export function ComingSoonBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-brand-surface-hover px-2.5 py-0.5 text-xs font-medium text-brand-muted">
      Próximamente
    </span>
  );
}
