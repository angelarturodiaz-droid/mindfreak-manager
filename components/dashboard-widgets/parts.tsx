import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

/** Colores del sistema para indicadores (ver app/globals.css). */
export type Tone = "accent" | "success" | "warning" | "danger" | "violet" | "teal";

const TONE_VAR: Record<Tone, string> = {
  accent: "var(--brand-accent)",
  success: "var(--brand-success)",
  warning: "var(--brand-warning)",
  danger: "var(--brand-danger)",
  violet: "var(--chart-5)",
  teal: "var(--chart-6)",
};

const TONE_BG: Record<Tone, string> = {
  accent: "var(--brand-accent-light)",
  success: "var(--brand-success-bg)",
  warning: "var(--brand-warning-bg)",
  danger: "var(--brand-danger-bg)",
  violet: "var(--chart-5-bg)",
  teal: "var(--chart-6-bg)",
};

export function toneColor(tone: Tone) {
  return TONE_VAR[tone];
}

/** Anillo de progreso con el % en el centro. `value` null = sin dato ("—"). */
export function RingGauge({ value, tone, label }: { value: number | null; tone: Tone; label?: string }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  const pct = value === null || !Number.isFinite(value) ? 0 : Math.max(0, Math.min(100, value));
  const text = value === null || !Number.isFinite(value) ? "—" : `${Math.round(value)}%`;
  return (
    <div className="relative h-12 w-12 shrink-0" title={label}>
      <svg viewBox="0 0 48 48" className="h-12 w-12 -rotate-90">
        <circle cx="24" cy="24" r={r} fill="none" stroke="var(--brand-border)" strokeWidth="5" />
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke={TONE_VAR[tone]}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * c} ${c}`}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold tabular-nums text-brand-text">
        {text}
      </span>
    </div>
  );
}

function IconBadge({ icon, tone }: { icon: ReactNode; tone: Tone }) {
  return (
    <span
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
      style={{ background: TONE_BG[tone], color: TONE_VAR[tone] }}
    >
      {icon}
    </span>
  );
}

/** Indicador compacto: anillo o ícono a la izquierda, etiqueta, monto y una línea de detalle. */
export function KpiTile({
  label,
  value,
  sub,
  subTone,
  tone = "accent",
  ring,
  icon,
  href,
  danger,
  title,
}: {
  label: string;
  value: string;
  /** Monto exacto al pasar el mouse (cuando `value` va redondeado). */
  title?: string;
  sub?: ReactNode;
  subTone?: Tone;
  tone?: Tone;
  /** Si viene, se dibuja el anillo con este % en lugar del ícono. */
  ring?: { value: number | null; label?: string; tone?: Tone };
  icon?: ReactNode;
  href?: string;
  danger?: boolean;
}) {
  const body = (
    <div className="@container flex h-full min-w-0 flex-col gap-2 rounded-[var(--radius-lg)] border border-brand-border bg-brand-surface px-3.5 py-3 shadow-[var(--shadow-sm)] transition-shadow hover:shadow-[var(--shadow-md)]">
      <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-brand-muted" title={label}>
        {label}
      </p>
      <div className="flex min-w-0 items-center gap-3">
        {ring ? (
          <RingGauge value={ring.value} tone={ring.tone ?? tone} label={ring.label} />
        ) : (
          icon && <IconBadge icon={icon} tone={tone} />
        )}
        <div className="min-w-0 flex-1">
          <p
            title={title}
            className={`whitespace-nowrap text-base font-semibold tracking-tight tabular-nums @[12rem]:text-lg @[15rem]:text-xl ${
              danger ? "text-brand-danger" : "text-brand-text"
            }`}
          >
            {value}
          </p>
          {sub && (
            <p
              className="line-clamp-2 text-xs leading-snug text-brand-muted"
              style={subTone ? { color: TONE_VAR[subTone] } : undefined}
            >
              {sub}
            </p>
          )}
        </div>
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}

/** Panel con título en mayúsculas, dato a la derecha y enlace "Ver". */
export function Panel({
  title,
  right,
  href,
  children,
}: {
  title: string;
  right?: ReactNode;
  href?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex h-full min-w-0 flex-col gap-3 rounded-[var(--radius-lg)] border border-brand-border bg-brand-surface p-4 shadow-[var(--shadow-sm)]">
      <header className="flex items-center justify-between gap-3">
        <h3 className="truncate text-xs font-semibold uppercase tracking-wide text-brand-text">{title}</h3>
        <div className="flex shrink-0 items-center gap-2 text-xs text-brand-muted">
          {right}
          {href && (
            <Link href={href} className="flex items-center text-brand-accent hover:underline">
              Ver <ChevronRight size={13} />
            </Link>
          )}
        </div>
      </header>
      <div className="flex-1">{children}</div>
    </section>
  );
}

/** Barra horizontal con etiqueta y monto (tipo "ventas por región"). */
export function BarRow({
  label,
  valueLabel,
  pct,
  tone,
  hint,
}: {
  label: string;
  valueLabel: string;
  /** 0–100, largo de la barra. */
  pct: number;
  tone: Tone;
  hint?: string;
}) {
  const w = Math.max(0, Math.min(100, pct));
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="truncate text-brand-text">
          {label}
          {hint && <span className="ml-1 text-brand-muted">{hint}</span>}
        </span>
        <span className="shrink-0 font-semibold tabular-nums text-brand-text">{valueLabel}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-brand-surface-hover">
        <div
          className="h-full rounded-full"
          style={{ width: `${w > 0 ? Math.max(w, 2) : 0}%`, background: TONE_VAR[tone] }}
        />
      </div>
    </div>
  );
}

/** Lista corta de filas (nombre + detalle a la izquierda, monto/chip a la derecha). */
export function MiniList({
  rows,
  empty,
}: {
  rows: { key: string; left: string; sub?: string; right: ReactNode; chip?: { text: string; tone: Tone } }[];
  empty: string;
}) {
  if (rows.length === 0) return <p className="py-4 text-center text-sm text-brand-muted">{empty}</p>;
  return (
    <ul className="flex flex-col divide-y divide-brand-border">
      {rows.map((r) => (
        <li key={r.key} className="flex items-center justify-between gap-3 py-2 text-sm first:pt-0 last:pb-0">
          <div className="min-w-0">
            <p className="truncate font-medium text-brand-text">{r.left}</p>
            {r.sub && <p className="truncate text-xs text-brand-muted">{r.sub}</p>}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-0.5">
            <span className="font-semibold tabular-nums">{r.right}</span>
            {r.chip && (
              <span
                className="rounded-full px-1.5 py-px text-[10px] font-medium"
                style={{ background: TONE_BG[r.chip.tone], color: TONE_VAR[r.chip.tone] }}
              >
                {r.chip.text}
              </span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
