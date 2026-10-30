"use client";

import { useId, useState, useSyncExternalStore, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { InfoHint } from "./info-hint";

/**
 * Bloque que se pliega y se acuerda (en esta computadora) de si lo dejaste
 * abierto o cerrado. Para pantallas largas con varias secciones (ej. las
 * pestañas del proyecto): cada quien ve primero lo que le importa.
 *
 * El contenido se dibuja siempre (solo se oculta), así un formulario a medio
 * llenar no se pierde al plegar.
 */
export function FoldableSection({
  storageKey,
  title,
  icon,
  count,
  countLabel,
  summary,
  description,
  info,
  action,
  defaultOpen = true,
  tone = "default",
  children,
}: {
  /** Llave única para recordar el estado, ej. "proyecto.ventas.facturas". */
  storageKey: string;
  title: string;
  icon?: ReactNode;
  count?: number;
  /** Qué se cuenta (ej. «facturas»): sale junto al número. */
  countLabel?: string;
  /** Dato corto a la derecha del título (ej. un total). */
  summary?: ReactNode;
  description?: ReactNode;
  info?: string;
  /** Botones a la derecha (ej. «Nueva factura»). No pliegan el bloque. */
  action?: ReactNode;
  defaultOpen?: boolean;
  tone?: "default" | "accent";
  children: ReactNode;
}) {
  const key = `mf.fold.${storageKey}`;
  const bodyId = useId();
  // Lo que el usuario dejó la última vez en esta computadora (null = nada guardado).
  const stored = useSyncExternalStore(subscribeStorage, () => readStored(key), () => null);
  const [override, setOverride] = useState<boolean | null>(null);
  const open = override ?? stored ?? defaultOpen;

  function toggle() {
    const next = !open;
    setOverride(next);
    try {
      window.localStorage.setItem(key, next ? "1" : "0");
    } catch {
      /* sin almacenamiento: solo cambia en pantalla */
    }
  }

  return (
    <section
      className={`rounded-[var(--radius-lg)] border bg-brand-surface shadow-[var(--shadow-sm)] ${
        tone === "accent" ? "border-brand-accent/30" : "border-brand-border"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <div className="flex min-w-0 flex-col">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={toggle}
              aria-expanded={open}
              aria-controls={bodyId}
              title={open ? "Pulsa para ocultar (se recuerda)" : "Pulsa para ver (se recuerda)"}
              className="flex min-w-0 items-center gap-2 text-left text-base font-semibold text-brand-text hover:text-brand-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
            >
              <ChevronDown
                size={16}
                className={`shrink-0 text-brand-muted transition-transform ${open ? "" : "-rotate-90"}`}
                aria-hidden
              />
              {icon && <span className="shrink-0 text-brand-accent">{icon}</span>}
              <span className="truncate">{title}</span>
              {count !== undefined && (
                <span className="shrink-0 rounded-full bg-brand-surface-hover px-2 py-0.5 text-xs font-medium tabular-nums text-brand-muted">
                  {count}
                  {countLabel ? ` ${countLabel}` : ""}
                </span>
              )}
            </button>
            {info && <InfoHint text={info} />}
          </div>
          {description && open && <p className="pl-6 text-sm text-brand-muted">{description}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {summary}
          {action}
          {!open && (
            <button type="button" onClick={toggle} className="text-xs text-brand-accent hover:underline">
              Ver
            </button>
          )}
        </div>
      </div>
      <div id={bodyId} hidden={!open} className="border-t border-brand-border p-3">
        {children}
      </div>
    </section>
  );
}

function readStored(key: string): boolean | null {
  try {
    const v = window.localStorage.getItem(key);
    return v === "1" ? true : v === "0" ? false : null;
  } catch {
    return null;
  }
}

function subscribeStorage(cb: () => void) {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
}
