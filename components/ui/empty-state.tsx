import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[var(--radius-lg)] border border-dashed border-brand-border bg-brand-surface px-6 py-12 text-center">
      {icon && <div className="text-brand-muted">{icon}</div>}
      <div>
        <p className="text-sm font-medium text-brand-text">{title}</p>
        {description && <p className="mt-1 text-sm text-brand-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
