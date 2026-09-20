import Link from "next/link";
import { FIELD_CLASSES } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { PERIOD_OPTIONS, type Period } from "@/features/comparisons/period";

/**
 * Barra de período — igual patrón que el resto de la app (links y forms
 * nativos con GET, sin JS de cliente): pastillas para los períodos
 * predefinidos y, al lado, un rango personalizado.
 */
export function PeriodBar({ tab, period }: { tab: string; period: Period }) {
  function hrefFor(periodKey: string) {
    return `/comparisons?tab=${tab}&period=${periodKey}`;
  }

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2 rounded-[var(--radius-lg)] border border-brand-border bg-brand-surface p-3">
      <div className="flex flex-wrap gap-1.5">
        {PERIOD_OPTIONS.filter((o) => o.key !== "custom").map((o) => (
          <Link
            key={o.key}
            href={hrefFor(o.key)}
            className={
              period.key === o.key
                ? "rounded-full bg-brand-accent px-3 py-1.5 text-xs font-medium text-white"
                : "rounded-full px-3 py-1.5 text-xs font-medium text-brand-text hover:bg-brand-surface-hover"
            }
          >
            {o.label}
          </Link>
        ))}
      </div>

      <div className="h-6 w-px bg-brand-border" />

      <form action="/comparisons" method="get" className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="tab" value={tab} />
        <input type="hidden" name="period" value="custom" />
        <input
          type="date"
          name="from"
          defaultValue={period.key === "custom" ? period.from : ""}
          className={`${FIELD_CLASSES} w-auto py-1.5 text-xs`}
        />
        <span className="text-xs text-brand-muted">a</span>
        <input
          type="date"
          name="to"
          defaultValue={period.key === "custom" ? period.to : ""}
          className={`${FIELD_CLASSES} w-auto py-1.5 text-xs`}
        />
        <Button type="submit" variant="outline" size="sm">
          Personalizado
        </Button>
      </form>

      <span className="ml-auto text-xs text-brand-muted">
        Período: <span className="font-medium text-brand-text">{period.label}</span> · comparado contra{" "}
        <span className="font-medium text-brand-text">{period.prevLabel}</span>
      </span>
    </div>
  );
}
