import Link from "next/link";
import type { ReactNode } from "react";
import { Card } from "./card";
import { IconBadge, type IconBadgeTone } from "./icon-badge";

/**
 * Piezas de diseño compartidas por las pantallas de lista y detalle
 * (Proyectos, Clientes, Cotizaciones, Facturas, Gastos, etc.) para que
 * todas se vean y se lean igual. Solo presentación — sin lógica de negocio.
 */

/** Tarjeta de resumen con ícono (encabezado de las listas). */
export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "blue",
  valueTone,
}: {
  label: string;
  value: string;
  hint?: ReactNode;
  icon: ReactNode;
  tone?: IconBadgeTone;
  valueTone?: "danger" | "warning" | "success";
}) {
  const valueColor =
    valueTone === "danger"
      ? "text-brand-danger"
      : valueTone === "warning"
        ? "text-brand-warning"
        : valueTone === "success"
          ? "text-brand-success"
          : "text-brand-text";
  return (
    <Card className="flex min-w-0 items-start gap-4">
      <IconBadge icon={icon} tone={tone} size="lg" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-brand-muted">{label}</p>
        <p
          className={`mt-0.5 break-words text-xl font-semibold tracking-tight tabular-nums sm:text-2xl ${valueColor}`}
        >
          {value}
        </p>
        {hint && <p className="mt-0.5 text-xs text-brand-muted">{hint}</p>}
      </div>
    </Card>
  );
}

/** Grilla estándar para 2–4 StatCard. */
export function StatGrid({ children }: { children: ReactNode }) {
  return <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{children}</section>;
}

export type FilterPill = { key: string; label: string; href: string; count?: number; active: boolean };

/** Filtros tipo "pastilla" con conteo (Todos 12 · Borrador 3 · …). */
export function FilterPills({ items, label }: { items: FilterPill[]; label: string }) {
  return (
    <nav aria-label={label} className="flex flex-wrap gap-1.5">
      {items.map((it) => (
        <Link
          key={it.key}
          href={it.href}
          aria-current={it.active ? "page" : undefined}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
            it.active
              ? "border-brand-primary bg-brand-primary text-white"
              : "border-brand-border bg-brand-surface text-brand-muted hover:bg-brand-surface-hover hover:text-brand-text"
          }`}
        >
          {it.label}
          {it.count !== undefined && (
            <span
              className={`rounded-full px-1.5 text-xs tabular-nums ${
                it.active ? "bg-white/20 text-white" : "bg-brand-surface-hover text-brand-muted"
              }`}
            >
              {it.count}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}

/** Arma un href de lista conservando filtros y quitando los vacíos. */
export function listHref(basePath: string, params: Record<string, string | undefined>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
  const s = qs.toString();
  return s ? `${basePath}?${s}` : basePath;
}

/** Título de sección con conteo opcional y acción a la derecha. */
export function SectionHeader({
  title,
  description,
  count,
  action,
}: {
  title: string;
  description?: ReactNode;
  count?: number;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 className="flex items-center gap-2 text-base font-semibold text-brand-text">
          {title}
          {count !== undefined && (
            <span className="rounded-full bg-brand-surface-hover px-2 py-0.5 text-xs font-medium tabular-nums text-brand-muted">
              {count}
            </span>
          )}
        </h2>
        {description && <p className="text-sm text-brand-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function ProgressBar({ pct, danger }: { pct: number; danger?: boolean }) {
  const width = Math.max(0, Math.min(100, pct));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-brand-surface-hover">
      <div
        className={`h-full rounded-full ${danger ? "bg-brand-danger" : "bg-brand-accent"}`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

/** Tarjeta de métrica simple (detalle de un registro). */
export function MetricCard({
  label,
  value,
  hint,
  pct,
  tone,
}: {
  label: string;
  value: string;
  hint?: ReactNode;
  pct?: number | null;
  tone?: "danger" | "warning" | "success";
}) {
  const color =
    tone === "danger"
      ? "text-brand-danger"
      : tone === "warning"
        ? "text-brand-warning"
        : tone === "success"
          ? "text-brand-success"
          : "text-brand-text";
  return (
    <Card className="flex min-w-0 flex-col gap-2">
      <p className="text-sm font-medium text-brand-muted">{label}</p>
      <p className={`break-words text-xl font-semibold tracking-tight tabular-nums ${color}`}>{value}</p>
      {pct !== undefined && pct !== null && <ProgressBar pct={pct} danger={tone === "danger" || pct > 100} />}
      {hint && <p className="text-xs text-brand-muted">{hint}</p>}
    </Card>
  );
}

const AVATAR_TONES = [
  "bg-brand-accent-light text-brand-accent",
  "bg-brand-success-bg text-brand-success",
  "bg-brand-warning-bg text-brand-warning",
  "bg-chart-5-bg text-chart-5",
  "bg-chart-6-bg text-chart-6",
];

export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export function avatarToneOf(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length];
}

/** Círculo con iniciales, color estable por nombre. */
export function InitialsAvatar({
  name,
  size = "md",
  muted,
}: {
  name: string;
  size?: "sm" | "md" | "lg";
  muted?: boolean;
}) {
  const sizes = { sm: "h-7 w-7 text-[11px]", md: "h-9 w-9 text-xs", lg: "h-14 w-14 text-lg" };
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold ${sizes[size]} ${
        muted ? "bg-brand-surface-hover text-brand-muted" : avatarToneOf(name)
      }`}
    >
      {initialsOf(name)}
    </span>
  );
}

export type ChipTone = "accent" | "warning" | "danger" | "success" | "muted";
const CHIP_CLASSES: Record<ChipTone, string> = {
  accent: "bg-brand-accent-light text-brand-accent",
  warning: "bg-brand-warning-bg text-brand-warning",
  danger: "bg-brand-danger-bg text-brand-danger",
  success: "bg-brand-success-bg text-brand-success",
  muted: "bg-brand-surface-hover text-brand-muted",
};

/** Etiqueta pequeña de contexto ("Vence en 3 días", "Vencida hace 2 días"). */
export function Chip({ tone = "muted", children }: { tone?: ChipTone; children: ReactNode }) {
  return (
    <span className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${CHIP_CLASSES[tone]}`}>
      {children}
    </span>
  );
}

/** Aviso destacado (acciones pendientes, recordatorios). */
export function Callout({
  icon,
  title,
  description,
  tone = "blue",
  children,
}: {
  icon: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  tone?: "blue" | "amber" | "red";
  children?: ReactNode;
}) {
  const box =
    tone === "amber"
      ? "border-brand-warning/30 bg-brand-warning-bg"
      : tone === "red"
        ? "border-brand-danger/30 bg-brand-danger-bg"
        : "border-brand-accent/25 bg-brand-accent-light";
  return (
    <section className={`rounded-[var(--radius-lg)] border p-5 ${box}`}>
      <div className="flex items-center gap-3">
        <IconBadge icon={icon} tone={tone === "amber" ? "amber" : tone === "red" ? "red" : "blue"} />
        <div>
          <p className="text-sm font-semibold text-brand-text">{title}</p>
          {description && <p className="text-xs text-brand-muted">{description}</p>}
        </div>
      </div>
      {children && <div className="mt-4">{children}</div>}
    </section>
  );
}
