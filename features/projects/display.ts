/**
 * Utilidades de presentación de proyectos compartidas por la lista
 * (/projects) y el detalle (/projects/[id]): nombres de estado, orden del
 * flujo, formato de fecha y cuenta regresiva al evento.
 */

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  PLANNING: "Planificación",
  CONFIRMED: "Confirmado",
  IN_PROGRESS: "En curso",
  COMPLETED: "Completado",
  CANCELLED: "Cancelado",
};

/** Flujo normal de un proyecto (Cancelado queda fuera, es una salida del flujo). */
export const PROJECT_FLOW = ["PLANNING", "CONFIRMED", "IN_PROGRESS", "COMPLETED"] as const;

/** Estados que cuentan como proyecto "activo" (todavía por ejecutarse). */
export const ACTIVE_PROJECT_STATUSES = ["PLANNING", "CONFIRMED", "IN_PROGRESS"];

const TIME_ZONE = "America/Santo_Domingo";

/** Fecha de hoy (YYYY-MM-DD) en la zona horaria de la empresa. */
export function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(new Date());
}

/** Días entre hoy y una fecha YYYY-MM-DD (negativo si ya pasó). */
export function daysUntil(dateISO: string): number {
  const toUtc = (d: string) => {
    const [y, m, day] = d.split("-").map(Number);
    return Date.UTC(y, m - 1, day);
  };
  return Math.round((toUtc(dateISO) - toUtc(todayISO())) / 86_400_000);
}

/** "24 sep 2026" */
export function formatEventDate(dateISO: string): string {
  return new Intl.DateTimeFormat("es-DO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${dateISO}T00:00:00Z`));
}

/** "7:30 p. m." a partir de "19:30:00" */
export function formatEventTime(time: string | null): string | null {
  if (!time) return null;
  const [h, m] = time.split(":").map(Number);
  return new Intl.DateTimeFormat("es-DO", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2000, 0, 1, h, m)));
}

export type CountdownTone = "accent" | "warning" | "danger" | "muted";

/**
 * Texto corto de cuánto falta para el evento ("Hoy", "Mañana", "En 5 días",
 * "Hace 3 días"). Un evento ya pasado solo se marca en rojo si el proyecto
 * sigue abierto (no está completado ni cancelado) — es algo por cerrar.
 */
export function eventCountdown(
  dateISO: string | null,
  status: string,
): { label: string; tone: CountdownTone } | null {
  if (!dateISO) return null;
  const d = daysUntil(dateISO);
  const closed = status === "COMPLETED" || status === "CANCELLED";
  if (d === 0) return { label: "Hoy", tone: closed ? "muted" : "warning" };
  if (d === 1) return { label: "Mañana", tone: closed ? "muted" : "warning" };
  if (d > 1) return { label: `En ${d} días`, tone: d <= 7 && !closed ? "warning" : "accent" };
  const ago = -d;
  const label = ago === 1 ? "Ayer" : `Hace ${ago} días`;
  return { label, tone: closed ? "muted" : "danger" };
}

export const COUNTDOWN_CLASSES: Record<CountdownTone, string> = {
  accent: "bg-brand-accent-light text-brand-accent",
  warning: "bg-brand-warning-bg text-brand-warning",
  danger: "bg-brand-danger-bg text-brand-danger",
  muted: "bg-brand-surface-hover text-brand-muted",
};

export function formatMoney(amount: number, currency = "DOP") {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency }).format(amount);
}
