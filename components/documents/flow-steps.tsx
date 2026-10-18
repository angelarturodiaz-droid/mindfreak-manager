import { Check } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import { InfoHint } from "@/components/ui/info-hint";

export type FlowStep = {
  label: string;
  /** Línea corta debajo del nombre (qué significa en pocas palabras). */
  sub: string;
  /** Explicación completa al pasar el mouse. */
  help: string;
  state: "done" | "current" | "overdue" | "todo";
};

/**
 * Pasos de avance de un documento (factura, cotización) con explicación:
 * título "Avance de…", una línea corta en cada paso y el detalle al pasar el
 * mouse (o con Tab). Mismo estilo que el avance del proyecto.
 */
export function FlowSteps({ title, hint, steps }: { title: string; hint: string; steps: FlowStep[] }) {
  return (
    <div className="border-t border-brand-border pt-5">
      <p className="mb-3 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs font-medium uppercase tracking-wide text-brand-muted">
        {title}
        <span className="hidden font-normal normal-case tracking-normal sm:inline">· pasa el mouse por un paso para ver qué significa</span>
        <InfoHint text={hint} label={`Qué es el ${title.toLowerCase()}`} />
      </p>
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label={title}>
        {steps.map((s, i) => {
          const done = s.state === "done";
          const current = s.state === "current";
          const overdue = s.state === "overdue";
          return (
            <Tooltip key={s.label + i} text={s.help}>
              <li
                tabIndex={0}
                aria-current={current || overdue ? "step" : undefined}
                className={`flex cursor-help items-center gap-2.5 rounded-[var(--radius-md)] border px-3 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-brand-accent ${
                  overdue
                    ? "border-brand-danger/40 bg-brand-danger-bg"
                    : done
                      ? "border-brand-success/40 bg-brand-success-bg"
                      : current
                        ? "border-brand-accent/40 bg-brand-accent-light"
                        : "border-brand-border bg-brand-surface"
                }`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    done
                      ? "bg-brand-success text-white"
                      : overdue
                        ? "bg-brand-danger text-white"
                        : current
                          ? "bg-brand-accent text-white ring-4 ring-brand-accent-light"
                          : "border border-brand-border bg-brand-surface text-brand-muted"
                  }`}
                >
                  {done ? <Check size={14} /> : i + 1}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span
                    className={`text-sm ${current || overdue ? "font-semibold text-brand-text" : done ? "text-brand-text" : "text-brand-muted"}`}
                  >
                    {s.label}
                  </span>
                  <span className={`text-xs leading-snug ${overdue ? "text-brand-danger" : "text-brand-muted"}`}>{s.sub}</span>
                </span>
              </li>
            </Tooltip>
          );
        })}
      </ol>
    </div>
  );
}
