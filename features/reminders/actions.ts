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

/** Guarda Configuración → Recordatorios. */
export async function saveReminderSettingsAction(
  _prev: ReminderSettingsState,
  formData: FormData,
): Promise<ReminderSettingsState> {
  await requirePermission("settings.manage");
  const ids = await getCurrentUserCompanyIds();
  if (!ids.length) return { error: "Tu usuario no está asignado a ninguna compañía." };

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

  const invoice_subject = String(formData.get("invoice_subject") ?? "").trim();
  const invoice_message = String(formData.get("invoice_message") ?? "").trim();
  const whatsapp_message = String(formData.get("whatsapp_message") ?? "").trim();
  if (invoice_subject.length < 3) return { error: "Escribe el asunto del correo." };
  if (invoice_message.length < 10) return { error: "Escribe el mensaje del correo." };
  if (whatsapp_message.length < 10) return { error: "Escribe el mensaje de WhatsApp." };
  if ([invoice_subject, invoice_message, whatsapp_message].some((t) => t.length > MAX_TEXT)) {
    return { error: `Cada texto puede tener hasta ${MAX_TEXT} caracteres.` };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: before } = await supabase
    .from("reminder_settings")
    .select("auto_send_enabled, invoice_days")
    .eq("company_id", ids[0])
    .maybeSingle();
  const auto_send_enabled = formData.get("auto_send_enabled") === "on";
  const { error } = await supabase.from("reminder_settings").upsert({
    company_id: ids[0],
    auto_send_enabled,
    invoice_days,
    invoice_subject,
    invoice_message,
    whatsapp_message,
    updated_at: new Date().toISOString(),
    updated_by: user?.id ?? null,
  });
  if (error) return { error: "No se pudo guardar. Intenta de nuevo." };

  await logAudit({
    companyId: ids[0],
    action: "UPDATE",
    entityType: "reminder_settings",
    entityId: ids[0],
    oldValues: before ?? null,
    newValues: { auto_send_enabled, invoice_days },
  });
  revalidatePath("/settings/reminders");
  return {
    error: null,
    success: auto_send_enabled
      ? "Guardado. Los recordatorios por correo salen solos cada día a las 8:15 a. m."
      : "Guardado. Los envíos automáticos están apagados: no sale ningún correo a clientes.",
    successId: Date.now(),
  };
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
