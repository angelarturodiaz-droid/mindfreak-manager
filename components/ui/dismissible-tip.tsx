"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { Lightbulb, X } from "lucide-react";

/**
 * Consejo destacado (azul) arriba de un formulario. Se ve hasta que el
 * usuario pulsa «Entendido»; eso se recuerda en esta computadora
 * (localStorage `mf.tip.<storageKey>`). Si se ocultó, queda un enlace
 * pequeño «Ver consejo» para volver a mostrarlo.
 */
export function DismissibleTip({
  storageKey,
  title,
  children,
}: {
  storageKey: string;
  title: string;
  children: ReactNode;
}) {
  const key = `mf.tip.${storageKey}`;
  const stored = useSyncExternalStore(subscribe, () => read(key), () => false);
  const [override, setOverride] = useState<boolean | null>(null);
  const hidden = override ?? stored;

  function setHidden(next: boolean) {
    setOverride(next);
    try {
      if (next) window.localStorage.setItem(key, "1");
      else window.localStorage.removeItem(key);
    } catch {
      /* sin almacenamiento: solo cambia en pantalla */
    }
  }

  if (hidden) {
    return (
      <button
        type="button"
        onClick={() => setHidden(false)}
        className="inline-flex w-fit items-center gap-1 text-xs text-brand-accent hover:underline"
      >
        <Lightbulb size={13} aria-hidden /> Ver consejo: {title}
      </button>
    );
  }

  return (
    <section
      role="note"
      className="relative max-w-2xl rounded-[var(--radius-lg)] border border-brand-accent/30 bg-brand-accent-light px-4 py-3 pr-10"
    >
      <button
        type="button"
        onClick={() => setHidden(true)}
        aria-label="Ocultar consejo"
        title="Ocultar (se recuerda en esta computadora)"
        className="absolute right-2 top-2 rounded p-1 text-brand-muted hover:bg-brand-surface hover:text-brand-text"
      >
        <X size={15} />
      </button>
      <p className="flex items-center gap-2 text-sm font-semibold text-brand-text">
        <Lightbulb size={17} className="shrink-0 text-brand-accent" aria-hidden />
        {title}
      </p>
      <div className="mt-1.5 text-sm text-brand-text">{children}</div>
      <button
        type="button"
        onClick={() => setHidden(true)}
        className="mt-2 rounded-[var(--radius-md)] bg-brand-surface px-3 py-1 text-xs font-medium text-brand-accent hover:bg-brand-surface-hover"
      >
        Entendido, no mostrar de nuevo
      </button>
    </section>
  );
}

function read(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
}
