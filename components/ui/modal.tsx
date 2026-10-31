"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";

export function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** «lg» para formularios guiados más largos. */
  size?: "md" | "lg";
}) {
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative w-full ${size === "lg" ? "max-w-2xl" : "max-w-md"} rounded-[var(--radius-lg)] bg-brand-surface p-6 text-left font-normal shadow-[var(--shadow-lg)]`}
      >
        {title && (
          <h2 className="mb-4 text-base font-semibold text-brand-text">{title}</h2>
        )}
        {children}
      </div>
    </div>
  );
}
