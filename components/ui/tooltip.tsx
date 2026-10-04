"use client";

import { useEffect, useRef, useId, useState, type ReactElement, type SyntheticEvent } from "react";
import { createPortal } from "react-dom";

// Un solo temporizador para todos: solo se muestra una explicación a la vez.
let pendingTimer: ReturnType<typeof setTimeout> | null = null;
function clearTimer() {
  if (pendingTimer) clearTimeout(pendingTimer);
  pendingTimer = null;
}
function startTimer(fn: () => void, delay: number) {
  clearTimer();
  pendingTimer = setTimeout(fn, delay);
}

type Handlers = {
  onMouseEnter?: (e: SyntheticEvent<HTMLElement>) => void;
  onMouseLeave?: (e: SyntheticEvent<HTMLElement>) => void;
  onFocus?: (e: SyntheticEvent<HTMLElement>) => void;
  onBlur?: (e: SyntheticEvent<HTMLElement>) => void;
  onClick?: (e: SyntheticEvent<HTMLElement>) => void;
};

/**
 * Explicación corta que aparece al pasar el mouse por encima de un botón
 * (o al llegar con Tab), sin hacer clic. Se dibuja fuera de la tarjeta
 * (portal) para que no la corten las tablas ni los contenedores con scroll.
 * Uso normal: no se usa directo, sale sola en <Button> (ver lib/ui/button-hints.ts).
 */
export function Tooltip({ text, children }: { text: string; children: ReactElement<Handlers> }) {
  const id = useId();
  const [pos, setPos] = useState<{ x: number; y: number; below: boolean } | null>(null);
  function show(el: HTMLElement, delay: number) {
    startTimer(() => {
      const r = el.getBoundingClientRect();
      const below = r.top < 64;
      const half = 130;
      const x = Math.min(Math.max(r.left + r.width / 2, half), window.innerWidth - half);
      setPos({ x, y: below ? r.bottom + 8 : r.top - 8, below });
    }, delay);
  }
  function hide() {
    clearTimer();
    setPos(null);
  }

  useEffect(() => {
    if (!pos) return;
    const onScroll = () => setPos(null);
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [pos]);
  useEffect(() => clearTimer, []);
  // Accesibilidad: el elemento de adentro queda "descrito" por la explicación.
  const wrapRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = wrapRef.current?.firstElementChild;
    if (!el) return;
    if (pos) el.setAttribute("aria-describedby", id);
    else el.removeAttribute("aria-describedby");
  }, [pos, id]);

  // No se clona el hijo: si viene de un componente de servidor React lo
  // entrega como referencia diferida y clonarlo rompe la página. Se envuelve
  // en un <span style="display: contents"> (no cambia el diseño) que escucha
  // los eventos del botón o ícono de adentro.
  const targetOf = (e: SyntheticEvent<HTMLElement>) =>
    ((e.currentTarget.firstElementChild as HTMLElement | null) ?? e.currentTarget);
  const child = (
    <span
      ref={wrapRef}
      style={{ display: "contents" }}
      onMouseEnter={(e) => show(targetOf(e), 350)}
      onMouseLeave={hide}
      onFocus={(e) => {
        if ((e.target as HTMLElement).matches(":focus-visible")) show(e.target as HTMLElement, 0);
      }}
      onBlur={hide}
      onClickCapture={hide}
    >
      {children}
    </span>
  );

  return (
    <>
      {child}
      {pos &&
        createPortal(
          <div
            role="tooltip"
            id={id}
            style={{
              position: "fixed",
              left: pos.x,
              top: pos.y,
              transform: pos.below ? "translate(-50%, 0)" : "translate(-50%, -100%)",
            }}
            className="pointer-events-none z-[100] w-max max-w-[240px] rounded-[var(--radius-md)] bg-brand-primary px-2.5 py-1.5 text-center text-xs font-normal leading-snug text-white shadow-[var(--shadow-lg)]"
          >
            {text}
          </div>,
          document.body,
        )}
    </>
  );
}
