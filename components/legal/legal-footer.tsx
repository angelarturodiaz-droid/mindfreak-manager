"use client";

import { useState } from "react";
import { APP_VERSION, SUPPORT_EMAIL, copyrightText } from "@/lib/app-info";
import type { LegalSlug } from "@/lib/legal/content";
import { LegalDialog } from "./legal-dialog";

/**
 * Pie de página de todas las pantallas (login y sistema):
 * Política de Privacidad | Términos de Uso | Soporte
 * Mindfreak Events © 2026. Todos los derechos reservados. • v1.0.0
 */
export function LegalFooter({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState<LegalSlug | null>(null);
  const link = "text-brand-muted transition-colors hover:text-brand-accent hover:underline";

  return (
    <footer className={`flex flex-col items-center gap-1 px-4 py-4 text-center text-xs text-brand-muted ${className}`}>
      <nav aria-label="Enlaces legales" className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
        <button type="button" className={link} onClick={() => setOpen("privacidad")}>
          Política de Privacidad
        </button>
        <span aria-hidden>|</span>
        <button type="button" className={link} onClick={() => setOpen("terminos")}>
          Términos de Uso
        </button>
        <span aria-hidden>|</span>
        <a className={link} href={`mailto:${SUPPORT_EMAIL}?subject=Soporte%20Mindfreak%20Manager`} title={`Escribir a ${SUPPORT_EMAIL}`}>
          Soporte
        </a>
      </nav>
      <p>
        {copyrightText()} <span aria-hidden>•</span> v{APP_VERSION}
      </p>
      <LegalDialog slug={open} onClose={() => setOpen(null)} />
    </footer>
  );
}
