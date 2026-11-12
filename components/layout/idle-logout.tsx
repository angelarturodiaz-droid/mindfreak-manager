"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOutForInactivityAction } from "@/features/auth/actions";
import { IDLE_STORAGE_KEY, idleState } from "@/lib/session/idle";

const EVENTS = ["mousedown", "mousemove", "keydown", "scroll", "touchstart", "wheel"] as const;

function readStored(): number {
  try {
    return Number(localStorage.getItem(IDLE_STORAGE_KEY)) || 0;
  } catch {
    return 0;
  }
}

function writeStored(v: number) {
  try {
    localStorage.setItem(IDLE_STORAGE_KEY, String(v));
  } catch {
    // Navegador sin almacenamiento: el cierre funciona igual dentro de esta pestaña.
  }
}

/**
 * Cierra la sesión tras `minutes` minutos sin usar el sistema (Configuración → Seguridad). Avisa 60 s antes con
 * «Seguir conectado». La última actividad se comparte entre pestañas: trabajar en una mantiene vivas las demás, y al
 * vencer se cierran todas. Si se vuelve después de mucho tiempo (computadora suspendida), se cierra al abrir.
 */
export function IdleLogout({ minutes }: { minutes: number }) {
  const local = useRef(0);
  const closing = useRef(false);
  const [warning, setWarning] = useState<number | null>(null);
  // Mientras está el aviso, mover el mouse no cuenta: hay que pulsar «Seguir conectado».
  const warningRef = useRef<number | null>(null);

  const last = useCallback(() => Math.max(local.current, readStored()), []);

  const touch = useCallback(() => {
    const now = Date.now();
    // Se guarda como mucho cada 5 s para no escribir en cada movimiento del mouse.
    if (now - local.current > 5_000) {
      local.current = now;
      writeStored(now);
    }
  }, []);

  const logout = useCallback(async () => {
    if (closing.current) return;
    closing.current = true;
    writeStored(1); // las demás pestañas también se cierran en su próxima revisión
    try {
      await signOutForInactivityAction();
    } finally {
      window.location.href = "/login?motivo=inactividad";
    }
  }, []);

  useEffect(() => {
    // Al abrir: si la última actividad guardada ya venció (ej. la computadora estuvo suspendida), cerrar.
    const stored = readStored();
    if (stored > 1 && idleState(stored, Date.now(), minutes).phase === "expired") {
      void logout();
      return;
    }
    local.current = Date.now();
    writeStored(local.current);

    const onActivity = () => {
      if (warningRef.current === null) touch();
    };
    EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    const tick = window.setInterval(() => {
      const stored = readStored();
      if (stored === 1 && !closing.current) {
        // Otra pestaña cerró la sesión.
        closing.current = true;
        window.location.href = "/login?motivo=inactividad";
        return;
      }
      const st = idleState(last(), Date.now(), minutes);
      if (st.phase === "expired") void logout();
      else if (st.phase === "warning") setWarning(st.secondsLeft);
      else setWarning(null);
    }, 1_000);
    return () => {
      EVENTS.forEach((e) => window.removeEventListener(e, onActivity));
      window.clearInterval(tick);
    };
  }, [minutes, touch, last, logout]);

  useEffect(() => {
    warningRef.current = warning;
  }, [warning]);

  function stay() {
    local.current = Date.now();
    writeStored(local.current);
    setWarning(null);
  }

  if (warning === null) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" aria-hidden="true" />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label="Tu sesión se va a cerrar"
        className="relative flex w-full max-w-sm flex-col items-center gap-3 rounded-[var(--radius-lg)] bg-brand-surface px-6 pb-5 pt-6 text-center shadow-[var(--shadow-lg)]"
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-warning-bg text-brand-warning">
          <Clock size={22} aria-hidden />
        </span>
        <p className="text-base font-semibold text-brand-text">¿Sigues ahí?</p>
        <p className="text-sm text-brand-muted">
          Por seguridad, tu sesión se cerrará en <strong className="text-brand-text">{warning} segundos</strong> porque no has usado el
          sistema en {minutes} minutos.
        </p>
        <div className="mt-1 flex w-full justify-center gap-2">
          <Button type="button" variant="outline" onClick={() => void logout()}>
            Cerrar sesión
          </Button>
          <Button type="button" onClick={stay} autoFocus>
            Seguir conectado
          </Button>
        </div>
      </div>
    </div>
  );
}
