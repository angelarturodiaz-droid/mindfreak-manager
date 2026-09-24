/**
 * Fechas "de calendario" (YYYY-MM-DD) en la zona horaria de la empresa.
 * Solo presentación: formatos legibles y "en N días / hace N días".
 */
const TIME_ZONE = "America/Santo_Domingo";

export function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(new Date());
}

/** Días entre hoy y la fecha (negativo si ya pasó). */
export function daysFromToday(dateISO: string): number {
  const toUtc = (d: string) => {
    const [y, m, day] = d.slice(0, 10).split("-").map(Number);
    return Date.UTC(y, m - 1, day);
  };
  return Math.round((toUtc(dateISO) - toUtc(todayISO())) / 86_400_000);
}

/** "24 sept 2026" */
export function formatDate(dateISO: string | null | undefined): string {
  if (!dateISO) return "—";
  return new Intl.DateTimeFormat("es-DO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
    .format(new Date(`${dateISO.slice(0, 10)}T00:00:00Z`))
    .replace(" de ", " ");
}

/** "1 día" / "3 días" */
export function pluralDays(n: number): string {
  return `${n} ${Math.abs(n) === 1 ? "día" : "días"}`;
}

/**
 * Texto relativo para un vencimiento: "Vence hoy", "Vence mañana",
 * "Vence en 5 días", "Vencida hace 2 días".
 */
export function dueLabel(dateISO: string): { label: string; days: number } {
  const d = daysFromToday(dateISO);
  if (d === 0) return { label: "Vence hoy", days: d };
  if (d === 1) return { label: "Vence mañana", days: d };
  if (d > 1) return { label: `Vence en ${pluralDays(d)}`, days: d };
  return { label: `Vencida hace ${pluralDays(-d)}`, days: d };
}
