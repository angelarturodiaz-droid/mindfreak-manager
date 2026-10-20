import type { SupabaseClient } from "@supabase/supabase-js";
import { sendMail } from "@/lib/mail/send";
import { invoiceReminderEmailHtml } from "@/lib/mail/invoice-reminder-email";
import { surveyEmailHtml } from "@/lib/mail/survey-email";
import { fillPlaceholders } from "@/features/surveys/schema";
import { parseBankDetails } from "@/features/banks/bank-details";
import { formatMoney } from "@/lib/utils/money";
import { formatDate, todayISO } from "@/lib/utils/dates";
import {
  fillReminder,
  invoiceStepForToday,
  pickEmailRecipient,
  stepLabel,
  surveyStepForToday,
  whenText,
  daysBetween,
  type SentStep,
} from "./schedule";

/**
 * Motor de recordatorios (prueba BE). Lo usan:
 *  - la tarea diaria (POST /api/cron/reminders, sin sesión, con la clave de Vault);
 *  - el botón "Revisar ahora" de Configuración → Recordatorios (con sesión y
 *    permiso settings.manage).
 * La base valida quién llama (reminders_* de la migración 086). Aquí no se
 * usa la secret key.
 */

type CompanyRow = {
  company_id: string;
  name: string;
  logo_url: string | null;
  brand_primary: string | null;
  brand_accent: string | null;
  auto_send_enabled: boolean;
  /** Recordatorios de facturas encendidos (migración 087; si falta, se toma como encendido). */
  invoice_enabled?: boolean;
  invoice_days: number[];
  invoice_subject: string | null;
  invoice_message: string | null;
  whatsapp_message: string | null;
  survey_reminder_enabled: boolean;
  survey_after_days: number;
  survey_max: number;
  survey_subject: string | null;
  survey_message: string | null;
};

type InvoiceRow = {
  id: string;
  company_id: string;
  number: string;
  due_date: string;
  total: number;
  balance: number;
  currency: string;
  bank_details: unknown;
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  billing: { name: string | null; email: string | null; phone: string | null }[];
  sent_steps: SentStep[];
};

type SurveyRow = {
  id: string;
  company_id: string;
  token: string;
  recipient_name: string | null;
  recipient_email: string | null;
  reminder_count: number;
  last_contact_at: string | null;
  project_name: string;
  event_date: string | null;
  client_name: string | null;
};

type Candidates = { companies: CompanyRow[]; invoices: InvoiceRow[]; surveys: SurveyRow[] };

export type PlannedReminder = {
  kind: "INVOICE" | "SURVEY";
  entityId: string;
  companyId: string;
  step: number;
  /** "INV-0033 · Cliente SRL" / "Encuesta · Evento X" */
  title: string;
  /** "3 días antes", "Recordatorio 1 de 2"… */
  stepText: string;
  recipient: string | null;
  /** "María Gómez (cobros)" / "correo del cliente". */
  recipientLabel?: string | null;
  /** Por qué no se envía (sin correo, envíos apagados…). */
  blocked: string | null;
  subject: string;
  html: string;
  comment: string;
};

export type ReminderRunResult = {
  today: string;
  autoSendEnabled: boolean;
  planned: PlannedReminder[];
  sent: number;
  failed: number;
  errors: string[];
};

export const DEFAULT_SUBJECT = "Recordatorio: factura {factura} de {empresa}";
export const DEFAULT_MESSAGE =
  "Te recordamos que la factura {factura} por {monto} {cuando}. Si ya realizaste el pago, por favor ignora este mensaje o envíanos el comprobante. ¡Gracias!";

/** Decide qué toca hoy (sin enviar nada). */
export function planReminders(data: Candidates, today: string, origin: string): PlannedReminder[] {
  const byCompany = new Map(data.companies.map((c) => [c.company_id, c]));
  const out: PlannedReminder[] = [];

  for (const inv of data.invoices) {
    const co = byCompany.get(inv.company_id);
    if (!co || co.invoice_enabled === false) continue;
    const done = inv.sent_steps.filter((s) => s.kind === "INVOICE").map((s) => s.step);
    const step = invoiceStepForToday({ dueDate: inv.due_date, today, days: co.invoice_days, done });
    if (step === null) continue;
    const to = pickEmailRecipient(inv);
    const values = {
      cliente: inv.client_name,
      contacto: (to?.name ?? inv.contact_name ?? "").split(" ")[0],
      factura: inv.number,
      monto: formatMoney(Number(inv.balance), inv.currency),
      vence: formatDate(inv.due_date),
      cuando: whenText(inv.due_date, today, formatDate),
      empresa: co.name,
    };
    const overdue = daysBetween(inv.due_date, today) > 0;
    const subject = fillReminder(co.invoice_subject || DEFAULT_SUBJECT, values);
    const message = fillReminder(co.invoice_message || DEFAULT_MESSAGE, values);
    out.push({
      kind: "INVOICE",
      entityId: inv.id,
      companyId: inv.company_id,
      step,
      title: `${inv.number} · ${inv.client_name ?? "—"}`,
      stepText: stepLabel(step),
      recipient: to ? to.emails.join(", ") : null,
      recipientLabel: to?.label ?? null,
      blocked: to
        ? null
        : "Sin correo: marca un contacto «Recibe recordatorios de cobro» en el cliente o ponle correo al cliente.",
      subject,
      html: invoiceReminderEmailHtml({
        companyName: co.name,
        logoUrl: co.logo_url,
        brandPrimary: co.brand_primary,
        brandAccent: co.brand_accent,
        recipientName: to?.name ?? null,
        invoiceNumber: inv.number,
        balanceText: formatMoney(Number(inv.balance), inv.currency),
        totalText: formatMoney(Number(inv.total), inv.currency),
        dueText: overdue ? `Venció el ${formatDate(inv.due_date)}` : `Vence el ${formatDate(inv.due_date)}`,
        overdue,
        message,
        bankDetails: parseBankDetails(inv.bank_details),
      }),
      comment: `Recordatorio automático por correo (${stepLabel(step)})`,
    });
  }

  for (const s of data.surveys) {
    const co = byCompany.get(s.company_id);
    if (!co) continue;
    const step = surveyStepForToday({
      lastContactAt: s.last_contact_at,
      today,
      afterDays: co.survey_after_days,
      count: s.reminder_count,
      max: co.survey_max,
      enabled: co.survey_reminder_enabled,
    });
    if (step === null) continue;
    const values = {
      empresa: co.name,
      proyecto: s.project_name,
      cliente: s.client_name ?? "",
      contacto: s.recipient_name ?? "",
    };
    const subject = fillPlaceholders(co.survey_subject ?? "¿Cómo te fue con tu evento?", values);
    out.push({
      kind: "SURVEY",
      entityId: s.id,
      companyId: s.company_id,
      step,
      title: `Encuesta · ${s.project_name}`,
      stepText: `Recordatorio ${step} de ${co.survey_max}`,
      recipient: s.recipient_email,
      recipientLabel: s.recipient_name,
      blocked: s.recipient_email ? null : "La encuesta no tiene correo.",
      subject: `Recordatorio: ${subject}`,
      html: surveyEmailHtml({
        companyName: co.name,
        logoUrl: co.logo_url,
        brandPrimary: co.brand_primary,
        brandAccent: co.brand_accent,
        recipientName: s.recipient_name,
        projectName: s.project_name,
        eventDate: s.event_date,
        message: fillPlaceholders(co.survey_message ?? "Nos encantaría conocer tu opinión sobre el servicio.", values),
        link: `${origin}/encuesta/${s.token}`,
        isReminder: true,
      }),
      comment: `Recordatorio de encuesta ${step} de ${co.survey_max}`,
    });
  }
  return out;
}

/**
 * Revisa (y si `dryRun` es false, envía) los recordatorios de hoy.
 * Solo envía en empresas con el interruptor "Envíos automáticos" encendido.
 */
export async function runReminders(opts: {
  supabase: SupabaseClient;
  secret: string | null;
  source: "CRON" | "MANUAL";
  dryRun: boolean;
  origin: string;
}): Promise<ReminderRunResult> {
  const today = todayISO();
  const { data, error } = await opts.supabase.rpc("reminders_candidates", { p_secret: opts.secret });
  if (error) throw new Error(error.message);
  const candidates = data as Candidates;
  const enabled = new Set(candidates.companies.filter((c) => c.auto_send_enabled).map((c) => c.company_id));
  const planned = planReminders(candidates, today, opts.origin).map((p) =>
    !p.blocked && !enabled.has(p.companyId)
      ? { ...p, blocked: "Interruptor general apagado (Configuración → Recordatorios)." }
      : p,
  );
  const result: ReminderRunResult = {
    today,
    autoSendEnabled: enabled.size > 0,
    planned,
    sent: 0,
    failed: 0,
    errors: [],
  };
  if (opts.dryRun) return result;

  const toSend = planned.filter((p) => !p.blocked && p.recipient);
  if (!toSend.length) return result;

  // 1) Apartar (evita duplicados si dos revisiones corren a la vez).
  const { data: claimed, error: claimErr } = await opts.supabase.rpc("reminders_claim", {
    p_secret: opts.secret,
    p_source: opts.source,
    p_jobs: toSend.map((p) => ({
      kind: p.kind,
      entity_id: p.entityId,
      company_id: p.companyId,
      step: p.step,
      channel: "EMAIL",
      recipient: p.recipient,
    })),
  });
  if (claimErr) throw new Error(claimErr.message);
  const claimedRows = (claimed ?? []) as { log_id: string; kind: string; entity_id: string; step: number }[];

  // 2) Enviar uno por uno.
  const results: { log_id: string; ok: boolean; error?: string; comment: string }[] = [];
  for (const c of claimedRows) {
    const p = toSend.find((x) => x.kind === c.kind && x.entityId === c.entity_id && x.step === c.step);
    if (!p || !p.recipient) continue;
    const ok = await sendMail({ to: p.recipient, subject: p.subject, html: p.html });
    results.push({
      log_id: c.log_id,
      ok,
      error: ok ? undefined : "No se pudo enviar el correo (revisa la configuración SMTP).",
      comment: p.comment,
    });
    if (ok) result.sent += 1;
    else {
      result.failed += 1;
      result.errors.push(`${p.title}: no se pudo enviar a ${p.recipient}`);
    }
  }

  // 3) Registrar (historial de cobro, campana, contador de la encuesta).
  const { error: finErr } = await opts.supabase.rpc("reminders_finish", { p_secret: opts.secret, p_results: results });
  if (finErr) result.errors.push(`No se pudo registrar el resultado: ${finErr.message}`);
  return result;
}
