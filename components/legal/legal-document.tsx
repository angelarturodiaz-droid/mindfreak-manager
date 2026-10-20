"use client";

import { useRef, useState } from "react";
import { LEGAL_DATE, LEGAL_DOCS, LEGAL_VERSION, type LegalSlug } from "@/lib/legal/content";
import { formatDate } from "@/lib/utils/dates";

/**
 * Política de Privacidad / Términos de Uso: índice a la izquierda y el texto
 * a la derecha (en celular, el índice va arriba). Se usa en la ventana del
 * pie de página y en las páginas /legal/privacidad y /legal/terminos.
 */
export function LegalDocument({ slug, scrollClassName = "" }: { slug: LegalSlug; scrollClassName?: string }) {
  const doc = LEGAL_DOCS[slug];
  const [active, setActive] = useState(doc.sections[0]?.id);
  const scrollRef = useRef<HTMLDivElement>(null);

  function go(id: string) {
    setActive(id);
    const el = scrollRef.current?.querySelector<HTMLElement>(`#sec-${id}`);
    const box = scrollRef.current;
    if (el && box) box.scrollTo({ top: el.offsetTop - box.offsetTop - 8, behavior: "smooth" });
  }

  function onScroll() {
    const box = scrollRef.current;
    if (!box) return;
    const top = box.scrollTop + box.offsetTop + 24;
    let current = doc.sections[0]?.id;
    for (const s of doc.sections) {
      const el = box.querySelector<HTMLElement>(`#sec-${s.id}`);
      if (el && el.offsetTop <= top) current = s.id;
    }
    if (current !== active) setActive(current);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <nav
        aria-label="Índice"
        className="flex shrink-0 gap-1 overflow-x-auto border-b border-brand-border p-2 md:w-56 md:flex-col md:overflow-y-auto md:border-r md:border-b-0 md:p-3"
      >
        {doc.sections.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => go(s.id)}
            className={`shrink-0 rounded-[var(--radius-md)] px-3 py-2 text-left text-sm transition-colors ${
              active === s.id
                ? "bg-brand-accent-light font-medium text-brand-accent"
                : "text-brand-muted hover:bg-brand-surface-hover hover:text-brand-text"
            }`}
          >
            {i + 1}. {s.title}
          </button>
        ))}
      </nav>
      <div ref={scrollRef} onScroll={onScroll} className={`min-h-0 flex-1 overflow-y-auto px-5 py-4 md:px-7 ${scrollClassName}`}>
        <p className="mb-4 text-xs text-brand-muted">
          Versión {LEGAL_VERSION} · vigente desde el {formatDate(LEGAL_DATE)}
        </p>
        {doc.sections.map((s, i) => (
          <section key={s.id} id={`sec-${s.id}`} className="mb-6 scroll-mt-4">
            <h3 className="mb-2 text-base font-semibold text-brand-primary">
              {i + 1}. {s.title}
            </h3>
            {s.blocks.map((b, j) =>
              Array.isArray(b) ? (
                <ul key={j} className="mb-3 ml-5 list-disc space-y-1.5 text-sm leading-relaxed text-brand-text">
                  {b.map((li) => (
                    <li key={li}>{li}</li>
                  ))}
                </ul>
              ) : (
                <p key={j} className="mb-3 text-sm leading-relaxed text-brand-text">
                  {b}
                </p>
              ),
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
