"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, CircleAlert } from "lucide-react";

export type ResultTone = "success" | "danger" | "warning";

const TONE: Record<ResultTone, { icon: ReactNode; color: string; bg: string }> = {
  success: { icon: <CheckCircle2 size={26} />, color: "var(--brand-success)", bg: "var(--brand-success-bg)" },
  danger: { icon: <CircleAlert size={26} />, color: "var(--brand-danger)", bg: "var(--brand-danger-bg)" },
  warning: { icon: <AlertTriangle size={26} />, color: "var(--brand-warning)", bg: "var(--brand-warning-bg)" },
};

/**
 * Ventana emergente para el resultado de una operación (éxito, bloqueo o
 * algo que confirmar): ícono de color, título, mensaje y botones. Escape o
 * clic afuera = `onClose`.
 */
export function ResultDialog({
  open,
  tone,
  title,
  children,
  onClose,
  actions,
}: {
  open: boolean;
  tone: ResultTone;
  title: string;
  children?: ReactNode;
  onClose: () => void;
  /** Botones; si no vienen, se muestra uno solo "Cerrar". */
  actions?: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    // Foco en el botón principal para poder cerrar con Enter.
    const btn = panelRef.current?.querySelector<HTMLButtonElement>("[data-autofocus]");
    btn?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const t = TONE[tone];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role={tone === "success" ? "dialog" : "alertdialog"}
        aria-modal="true"
        aria-label={title}
        className="relative flex w-full max-w-sm flex-col items-center gap-3 rounded-[var(--radius-lg)] bg-brand-surface px-6 pb-5 pt-6 text-center shadow-[var(--shadow-lg)]"
      >
        <span
          className="flex h-14 w-14 items-center justify-center rounded-full"
          style={{ background: t.bg, color: t.color }}
          aria-hidden
        >
          {t.icon}
        </span>
        <h2 className="text-lg font-semibold text-brand-text">{title}</h2>
        {children && <div className="flex w-full flex-col gap-2 text-sm text-brand-muted">{children}</div>}
        <div className="mt-2 flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-center">
          {actions ?? (
            <button
              type="button"
              data-autofocus
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-[var(--radius-md)] bg-brand-primary px-5 py-2 text-sm font-medium text-white hover:bg-brand-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-1 sm:min-w-32"
            >
              Cerrar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
