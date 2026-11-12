/**
 * Cierre de sesión por inactividad: cálculo puro (se prueba solo). La pantalla guarda la última actividad en el
 * navegador (compartida entre pestañas) y cada pocos segundos pregunta en qué estado está.
 */
export const IDLE_WARNING_SECONDS = 60;
export const IDLE_STORAGE_KEY = "mf-last-activity";
export const IDLE_OPTIONS = [15, 30, 45, 60, 90, 120] as const;

export type IdleState = { phase: "active" } | { phase: "warning"; secondsLeft: number } | { phase: "expired" };

export function idleState(lastActivity: number, now: number, timeoutMinutes: number): IdleState {
  const limit = Math.max(5, timeoutMinutes) * 60_000;
  const idle = Math.max(0, now - lastActivity);
  if (idle >= limit) return { phase: "expired" };
  const left = Math.ceil((limit - idle) / 1000);
  if (left <= IDLE_WARNING_SECONDS) return { phase: "warning", secondsLeft: left };
  return { phase: "active" };
}

/** Minutos válidos (entre 5 y 240); cualquier otro valor vuelve a 30. */
export function sanitizeIdleMinutes(v: unknown): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 5 && n <= 240 ? n : 30;
}
