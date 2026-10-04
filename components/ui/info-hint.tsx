"use client";

import { Info } from "lucide-react";
import { Tooltip } from "./tooltip";

/**
 * Ícono ⓘ con una explicación sencilla al pasar el mouse (o al llegar con
 * Tab). Para términos que alguien sin formación contable puede no conocer:
 * "ISR retenido", "Neto a pagar", "Clasificación fiscal"…
 * Los textos comunes están en lib/ui/field-hints.ts.
 */
export function InfoHint({ text, label = "Más información" }: { text: string; label?: string }) {
  return (
    <Tooltip text={text}>
      <button
        type="button"
        aria-label={label}
        className="inline-flex h-4 w-4 shrink-0 cursor-help items-center justify-center rounded-full text-brand-muted hover:text-brand-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
      >
        <Info size={14} aria-hidden />
      </button>
    </Tooltip>
  );
}
