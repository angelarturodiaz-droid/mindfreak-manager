import type { ReactNode } from "react";
import { ArrowRight, CheckCircle2, AlertTriangle, ChevronDown } from "lucide-react";
import { InfoHint } from "@/components/ui/info-hint";
import { ProgressBar } from "@/components/ui/page-kit";

/**
 * Piezas del detalle de factura y cotización (rediseño 12-oct): qué hacer
 * ahora, los montos en una franja arriba y secciones laterales que se
 * pueden cerrar para no tener que bajar tanto.
 */

type StepTone = "next" | "warning" | "done";

const STEP_TONE: Record<StepTone, { box: string; icon: ReactNode; label: string }> = {
  next: {
    box: "border-brand-accent/40 bg-brand-accent-light",
    icon: <ArrowRight size={16} className="shrink-0 text-brand-accent" aria-hidden />,
    label: "Siguiente paso",
  },
  warning: {
    box: "border-brand-danger/30 bg-brand-danger-bg",
    icon: <AlertTriangle size={16} className="shrink-0 text-brand-danger" aria-hidden />,
    label: "Atención",
  },
  done: {
    box: "border-brand-success/40 bg-brand-success-bg",
    icon: <CheckCircle2 size={16} className="shrink-0 text-brand-success" aria-hidden />,
    label: "Listo",
  },
};

/** Franja "Siguiente paso: …" según el estado del documento. */
export function NextStepBar({ tone = "next", children }: { tone?: StepTone; children: ReactNode }) {
  const t = STEP_TONE[tone];
  return (
    <div className={`flex items-start gap-2.5 rounded-[var(--radius-md)] border px-3.5 py-2.5 text-sm ${t.box}`} role="status">
      <span className="mt-0.5">{t.icon}</span>
      <p className="text-brand-text">
        <span className="font-semibold">{t.label}: </span>
        {children}
      </p>
    </div>
  );
}

export type StripItem = {
  label: string;
  value: string;
  /** Explicación en la ⓘ. */
  info?: string;
  /** Nota pequeña debajo (ej. "18 % gravado"). */
  note?: string;
  tone?: "default" | "strong" | "success" | "warning" | "danger" | "muted";
};

const VALUE_TONE: Record<NonNullable<StripItem["tone"]>, string> = {
  default: "text-brand-text",
  strong: "text-brand-primary",
  success: "text-brand-success",
  warning: "text-brand-warning",
  danger: "text-brand-danger",
  muted: "text-brand-muted",
};

/** Montos del documento en una sola franja (se ve sin bajar). */
export function TotalsStrip({
  items,
  progress,
}: {
  items: StripItem[];
  /** Barra de lo pagado (facturas). */
  progress?: { pct: number; label: string; danger?: boolean };
}) {
  return (
    <section
      aria-label="Montos"
      className="rounded-[var(--radius-lg)] border border-brand-border bg-brand-surface px-4 py-3 shadow-[var(--shadow-sm)]"
    >
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:flex lg:flex-wrap lg:items-start lg:justify-between">
        {items.map((it) => (
          <div key={it.label} className="min-w-0">
            <dt className="flex items-center gap-1 text-xs text-brand-muted">
              {it.label}
              {it.info && <InfoHint text={it.info} />}
            </dt>
            <dd
              className={`whitespace-nowrap tabular-nums ${
                it.tone === "strong" ? "text-lg font-semibold" : "text-sm font-medium"
              } ${VALUE_TONE[it.tone ?? "default"]}`}
            >
              {it.value}
            </dd>
            {it.note && <p className="text-[11px] text-brand-muted">{it.note}</p>}
          </div>
        ))}
      </dl>
      {progress && (
        <div className="mt-3 flex items-center gap-3 border-t border-brand-border pt-3">
          <div className="flex-1">
            <ProgressBar pct={progress.pct} danger={progress.danger} />
          </div>
          <span className="whitespace-nowrap text-xs text-brand-muted">{progress.label}</span>
        </div>
      )}
    </section>
  );
}

/**
 * Tarjeta lateral que se abre y se cierra (sin JavaScript: <details>). Cerrada
 * muestra una línea de resumen para no tener que abrirla.
 */
export function SideSection({
  title,
  info,
  summary,
  defaultOpen = true,
  children,
}: {
  title: string;
  info?: string;
  /** Lo que se ve con la tarjeta cerrada. */
  summary?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-[var(--radius-lg)] border border-brand-border bg-brand-surface shadow-[var(--shadow-sm)]"
    >
      <summary className="flex cursor-pointer list-none items-start justify-between gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-brand-text">
            {title}
            {info && <InfoHint text={info} />}
          </span>
          {summary && <span className="mt-0.5 block text-xs text-brand-muted group-open:hidden">{summary}</span>}
        </span>
        <ChevronDown
          size={16}
          className="mt-0.5 shrink-0 text-brand-muted transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="border-t border-brand-border px-4 pb-4 pt-3">{children}</div>
    </details>
  );
}
