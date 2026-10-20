"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission, getCurrentUserCompanyIds } from "@/lib/auth/permissions";
import { logAudit } from "@/lib/audit/log";
import { getAppUrl } from "@/lib/utils/app-url";
import { normalizeDays } from "./schedule";
import { runReminders, type PlannedReminder } from "./engine";

export type ReminderSettingsState = { error: string | null; success?: string; successId?: number };

const MAX_TEXT = 1000;

async function companyAndUser() {
  const ids = await getCurrentUserCompanyIds();
  if (!ids.length) throw new Error("Tu usuario no está asignado a ninguna compañía.");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { companyId: ids[0], supabase, userId: user?.id ?? null };
}

function revalidateAll() {
  revalidatePath("/settings/reminders");
  revalidatePath("/settings/messages");
  revalidatePath("/invoices");
}

/** Interruptor general (vale para todos los recordatorios por correo). Se guarda al tocarlo. */
export async function setAutoSendAction(value: boolean): Promise<{ error: string | null }> {
  await requirePermission("settings.manage");
  const { companyId, supabase, userId } = await companyAndUser();
  const { error } = await supabase
    .from("reminder_settings")
    .upsert({ company_id: companyId, auto_send_enabled: value, updated_at: new Date().toISOString(), updated_by: userId });
  if (error) return { error: "No se pudo guardar. Intenta de nuevo." };
  await logAudit({
    companyId,
    action: "UPDATE",
    entityType: "reminder_settings",
    entityId: companyId,
    newValues: { interruptor_general: value },
  });
  revalidateAll();
  return { error: null };
}

/** Recordatorios → Facturas por cobrar: encendido y días respecto al vencimiento. */
export async function saveInvoiceReminderAction(
  _prev: ReminderSettingsState,
  formData: FormData,
): Promise<ReminderSettingsState> {
  await requirePermission("settings.manage");
  const rawDays = String(formData.get("invoice_days") ?? "")
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean)
    .map(Number);
  if (!rawDays.length) return { error: "Deja al menos un recordatorio de factura." };
  if (rawDays.some((d) => !Number.isInteger(d) || d < -60 || d > 120)) {
    return { error: "Cada recordatorio debe estar entre 60 días antes y 120 días después del vencimiento." };
  }
  const invoice_days = normalizeDays(rawDays);
  const invoice_enabled = formData.get("invoice_enabled") === "on";
  const { companyId, supabase, userId } = await companyAndUser();
  const { error } = await supabase.from("reminder_settings").upsert({
    company_id: companyId,
    invoice_enabled,
    invoice_days,
    updated_at: new Date().toISOString(),
    updated_by: userId,
  });
  if (error) return { error: "No se pudo guardar. ¿Ya se aplicó la migración 087?" };
  await logAudit({
    companyId,
    action: "UPDATE",
    entityType: "reminder_settings",
    entityId: companyId,
    newValues: { facturas: { encendido: invoice_enabled, dias: invoice_days } },
  });
  revalidateAll();
  return { error: null, success: "Recordatorios de facturas guardados.", successId: Date.now() };
}

/** Recordatorios → Encuesta: ofrecerla al finalizar el proyecto y recordarla si no responden. */
export async function saveSurveyReminderAction(
  _prev: ReminderSettingsState,
  formData: FormData,
): Promise<ReminderSettingsState> {
  await requirePermission("surveys.manage");
  const update: { send_by_default: boolean; reminder_enabled: boolean; reminder_after_days?: number; max_reminders?: number } = {
    send_by_default: formData.get("send_by_default") === "on",
    reminder_enabled: formData.get("reminder_enabled") === "on",
  };
  const afterRaw = formData.get("reminder_after_days");
  const maxRaw = formData.get("max_reminders");
  if (afterRaw !== null) {
    const n = Number(afterRaw);
    if (!Number.isInteger(n) || n < 1 || n > 60) return { error: "«Recordar cada» debe estar entre 1 y 60 días." };
    update.reminder_after_days = n;
  }
  if (maxRaw !== null) {
    const n = Number(maxRaw);
    if (!Number.isInteger(n) || n < 0 || n > 5) return { error: "El máximo de recordatorios va de 0 a 5." };
    update.max_reminders = n;
  }
  const { companyId, supabase } = await companyAndUser();
  const { error } = await supabase.from("survey_settings").update(update).eq("company_id", companyId);
  if (error) return { error: "No se pudo guardar. Intenta de nuevo." };
  await logAudit({
    companyId,
    action: "UPDATE",
    entityType: "survey_settings",
    entityId: companyId,
    newValues: { recordatorios_encuesta: update },
  });
  revalidateAll();
  revalidatePath("/settings/messages");
  return { error: null, success: "Recordatorios de la encuesta guardados.", successId: Date.now() };
}

/** Mensajes al cliente → Facturación: textos del recordatorio de cobro (correo y WhatsApp). */
export async function saveInvoiceMessagesAction(
  _prev: ReminderSettingsState,
  formData: FormData,
): Promise<ReminderSettingsState> {
  await requirePermission("settings.manage");
  const invoice_subject = String(formData.get("invoice_subject") ?? "").trim();
  const invoice_message = String(formData.get("invoice_message") ?? "").trim();
  const whatsapp_message = String(formData.get("whatsapp_message") ?? "").trim();
  if (invoice_subject.length < 3) return { error: "Escribe el asunto del correo." };
  if (invoice_message.length < 10) return { error: "Escribe el mensaje del correo." };
  if (whatsapp_message.length < 10) return { error: "Escribe el mensaje de WhatsApp." };
  if ([invoice_subject, invoice_message, whatsapp_message].some((t) => t.length > MAX_TEXT)) {
    return { error: `Cada texto puede tener hasta ${MAX_TEXT} caracteres.` };
  }
  const { companyId, supabase, userId } = await companyAndUser();
  const { error } = await supabase.from("reminder_settings").upsert({
    company_id: companyId,
    invoice_subject,
    invoice_message,
    whatsapp_message,
    updated_at: new Date().toISOString(),
    updated_by: userId,
  });
  if (error) return { error: "No se pudo guardar. Intenta de nuevo." };
  await logAudit({
    companyId,
    action: "UPDATE",
    entityType: "reminder_settings",
    entityId: companyId,
    newValues: { mensajes_factura: true },
  });
  revalidateAll();
  return { error: null, success: "Mensajes de cobro guardados.", successId: Date.now() };
}

export type ReminderPreviewItem = Omit<PlannedReminder, "html"> & { html: string };

export type ReminderRunState = {
  error: string | null;
  today?: string;
  autoSendEnabled?: boolean;
  items?: ReminderPreviewItem[];
  sent?: number;
  failed?: number;
  errors?: string[];
  ranAt?: number;
};

/** "Ver qué sale hoy": no envía nada. */
export async function previewRemindersAction(): Promise<ReminderRunState> {
  await requirePermission("settings.manage");
  try {
    const r = await runReminders({
      supabase: await createClient(),
      secret: null,
      source: "MANUAL",
      dryRun: true,
      origin: await getAppUrl(),
    });
    return { error: null, today: r.today, autoSendEnabled: r.autoSendEnabled, items: r.planned, ranAt: Date.now() };
  } catch {
    return { error: "No se pudo revisar. ¿Ya se aplicó la migración 086 en la base de datos?" };
  }
}

/** "Enviar ahora": lo mismo que la tarea diaria (solo si los envíos están encendidos). */
export async function sendRemindersNowAction(): Promise<ReminderRunState> {
  await requirePermission("settings.manage");
  try {
    const r = await runReminders({
      supabase: await createClient(),
      secret: null,
      source: "MANUAL",
      dryRun: false,
      origin: await getAppUrl(),
    });
    revalidatePath("/settings/reminders");
    return {
      error: null,
      today: r.today,
      autoSendEnabled: r.autoSendEnabled,
      items: r.planned,
      sent: r.sent,
      failed: r.failed,
      errors: r.errors,
      ranAt: Date.now(),
    };
  } catch {
    return { error: "No se pudo enviar. ¿Ya se aplicó la migración 086 en la base de datos?" };
  }
}

/** WhatsApp desde "Para recordar hoy": deja el registro en la factura. */
export async function markWhatsappReminderAction(
  invoiceId: string,
  step: number,
  phone: string | null,
): Promise<{ error: string | null }> {
  await requirePermission("invoices.view");
  const supabase = await createClient();
  const { error } = await supabase.rpc("reminder_mark_whatsapp", {
    p_invoice_id: invoiceId,
    p_step: step,
    p_phone: phone ?? "",
  });
  if (error) return { error: "No se pudo registrar el recordatorio. Intenta de nuevo." };
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  return { error: null };
}
