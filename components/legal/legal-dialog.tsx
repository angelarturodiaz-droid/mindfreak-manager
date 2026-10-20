"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ExternalLink, X } from "lucide-react";
import { LEGAL_DOCS, type LegalSlug } from "@/lib/legal/content";
import { APP_VERSION, copyrightText } from "@/lib/app-info";
import { LegalDocument } from "./legal-document";

/** Ventana con la Política de Privacidad o los Términos de Uso. */
export function LegalDialog({ slug, onClose }: { slug: LegalSlug | null; onClose: () => void }) {
  useEffect(() => {
    if (!slug) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [slug, onClose]);

  if (!slug) return null;
  const doc = LEGAL_DOCS[slug];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 text-left sm:p-6">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={doc.title}
        className="relative flex h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-[var(--radius-lg)] bg-brand-surface shadow-[var(--shadow-lg)]"
      >
        <div className="flex items-center gap-3 border-b border-brand-border px-5 py-3.5">
          <h2 className="text-lg font-semibold text-brand-primary">{doc.title}</h2>
          <div className="flex-1" />
          <Link
            href={`/legal/${slug}`}
            target="_blank"
            className="hidden items-center gap-1 text-xs font-medium text-brand-accent hover:underline sm:inline-flex"
            title="Abrir en una pestaña aparte (para imprimir o compartir el enlace)"
          >
            Abrir aparte <ExternalLink size={12} />
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-brand-muted hover:bg-brand-surface-hover hover:text-brand-text"
          >
            <X size={18} />
          </button>
        </div>
        <LegalDocument slug={slug} />
        <div className="border-t border-brand-border px-5 py-2.5 text-center text-xs text-brand-muted">
          {copyrightText()} · v{APP_VERSION}
        </div>
      </div>
    </div>
  );
}
