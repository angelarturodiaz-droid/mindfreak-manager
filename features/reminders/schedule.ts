/**
 * Motor de recordatorios (prueba BE): decide QUÉ recordar hoy. Funciones
 * puras (sin base de datos) para poder probarlas. La base entrega los datos
 * (reminders_candidates, migración 086) y la app decide, envía y registra.
 */

/** Si la tarea diaria no corrió algún día, se recupera hasta 2 días tarde. */
export const REMINDER_GRACE_DAYS = 2;

export const DEFAULT_INVOICE_DAYS = [-3, 0, 10];

export type SentStep = { kind: string; step: number };

/** Días entre dos fechas ISO (b − a). */
export function daysBetween(aISO: string, bISO: string): number {
  const toUtc = (d: string) => {
    const [y, m, day] = d.slice(0, 10).split("-").map(Number);
    return Date.UTC(y, m - 1, day);
  };
  return Math.round((toUtc(bISO) - toUtc(aISO)) / 86_400_000);
}

/** Días ordenados, sin repetir, dentro del rango permitido (−60 a 120). */
export function normalizeDays(days: readonly number[] | null | undefined): number[] {
  const clean = (days ?? [])
    .map((d) => Math.trunc(Number(d)))
    .filter((d) => Number.isFinite(d) && d >= -60 && d <= 120);
  const unique = Array.from(new Set(clean)).sort((a, b) => a - b);
  return unique.length ? unique.slice(0, 10) : [...DEFAULT_INVOICE_DAYS];
}

/**
 * Paso que toca hoy para una factura (días respecto al vencimiento) o null.
 * Toma el paso más reciente que ya llegó (hasta REMINDER_GRACE_DAYS tarde)
 * y que no se haya hecho por ese canal. Así, si la factura se emitió con
 * vencimiento hoy, no se manda el de "3 días antes" atrasado.
 */
export function invoiceStepForToday(params: {
  dueDate: string;
  today: string;
  days: readonly number[];
  done: readonly number[];
}): number | null {
  const diff = daysBetween(params.dueDate, params.today); // > 0 = ya venció
  const reached = normalizeDays(params.days).filter((d) => d <= diff && diff - d <= REMINDER_GRACE_DAYS);
  if (!reached.length) return null;
  const step = reached[reached.length - 1];
  return params.done.includes(step) ? null : step;
}

/**
 * ¿Toca recordatorio de encuesta? Cada `afterDays` desde el último contacto
 * (envío o recordatorio), hasta `max` recordatorios. Devuelve el número del
 * recordatorio (1, 2…) o null.
 */
export function surveyStepForToday(params: {
  lastContactAt: string | null;
  today: string;
  afterDays: number;
  count: number;
  max: number;
  enabled: boolean;
}): number | null {
  if (!params.enabled || !params.lastContactAt) return null;
  if (params.count >= Math.max(0, params.max)) return null;
  const since = daysBetween(params.lastContactAt.slice(0, 10), params.today);
  return since >= Math.max(1, params.afterDays) ? params.count + 1 : null;
}

/** Texto de {cuando}: "vence el 21 oct 2026", "vence hoy", "venció hace 10 días". */
export function whenText(dueDate: string, today: string, formatDate: (iso: string) => string): string {
  const diff = daysBetween(today, dueDate); // > 0 = falta
  if (diff > 1) return `vence el ${formatDate(dueDate)} (en ${diff} días)`;
  if (diff === 1) return `vence mañana, ${formatDate(dueDate)}`;
  if (diff === 0) return "vence hoy";
  if (diff === -1) return "venció ayer";
  return `venció hace ${-diff} días (${formatDate(dueDate)})`;
}

/** Nombre corto del paso para pantallas e historial. */
export function stepLabel(step: number): string {
  if (step < 0) return `${-step} día${step === -1 ? "" : "s"} antes`;
  if (step === 0) return "el día del vencimiento";
  return `${step} día${step === 1 ? "" : "s"} después`;
}

/** Reemplaza {cliente}, {contacto}, {factura}, {monto}, {vence}, {cuando}, {empresa}, {enlace}. */
export function fillReminder(template: string, values: Record<string, string | null | undefined>): string {
  return template
    .replace(/\{(\w+)\}/g, (m, key: string) => (key in values ? values[key] ?? "" : m))
    .replace(/Hola ,/g, "Hola,")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export type ContactInfo = {
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Decisión 18-oct: contacto principal si tiene correo; si no, el del cliente. */
export function pickEmailRecipient(c: ContactInfo): { email: string; name: string | null } | null {
  const contactEmail = c.contact_email?.trim();
  if (contactEmail && EMAIL_RE.test(contactEmail)) return { email: contactEmail, name: c.contact_name };
  const clientEmail = c.client_email?.trim();
  if (clientEmail && EMAIL_RE.test(clientEmail)) return { email: clientEmail, name: c.contact_name ?? null };
  return null;
}

/** Teléfono para WhatsApp: el del contacto principal o, si no, el del cliente. */
export function pickPhone(c: ContactInfo): string | null {
  return c.contact_phone?.trim() || c.client_phone?.trim() || null;
}
