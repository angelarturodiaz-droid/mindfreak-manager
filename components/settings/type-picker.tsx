"use client";

import { useRouter, usePathname } from "next/navigation";
import { InfoHint } from "@/components/ui/info-hint";

export type PickerOption = { value: string; label: string; soon?: boolean };

/**
 * Lista desplegable para elegir QUÉ se configura en la pantalla
 * (Encuesta / Facturación / Cotizaciones…). Cambia el `?tipo=` de la
 * dirección, así cada opción tiene su enlace y el navegador recuerda dónde
 * estabas.
 */
export function TypePicker({
  label,
  hint,
  options,
  value,
}: {
  label: string;
  hint: string;
  options: PickerOption[];
  value: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-lg)] border border-brand-accent/30 bg-brand-accent-light px-4 py-3">
      <label htmlFor="type-picker" className="flex items-center gap-1.5 text-sm font-semibold text-brand-text">
        {label}
        <InfoHint text={hint} />
      </label>
      <select
        id="type-picker"
        value={value}
        onChange={(e) => router.push(`${pathname}?tipo=${e.target.value}`)}
        className="min-w-64 rounded-[var(--radius-md)] border border-brand-border bg-brand-surface px-3 py-2 text-sm text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-accent"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
            {o.soon ? " (próximamente)" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
