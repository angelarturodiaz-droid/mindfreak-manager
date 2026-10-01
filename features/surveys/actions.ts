"use server";

import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission, getCurrentUserCompanyIds } from "@/lib/auth/permissions";
import { logAudit } from "@/lib/audit/log";
import { sendMail } from "@/lib/mail/send";
import { surveyEmailHtml } from "@/lib/mail/survey-email";
import { resolveSurveyRecipient } from "./queries";
import { fillPlaceholders, questionSchema, settingsSchema, type SurveyQuestionSnapshot } from "./schema";
import { z } from "zod";

/**
 * Encuesta de satisfacción (migración 068).
 *
 * Flujo: al finalizar un proyecto (o a mano desde la pestaña
 * "Satisfacción") se crea una encuesta con un token aleatorio de 256 bits
 * y una copia de las preguntas activas; se manda el correo con el enlace
 * /encuesta/{token}. Si el correo falla, la encuesta queda "Pendiente" con
 * el error guardado y el enlace se puede copiar y mandar por otra vía.
 * Todo queda en la auditoría del proyecto.
 */

export type SurveyActionState = {
  error: string | null;
  success?: string | null;
  link?: string | null;
  /** El correo no salió (o no hay correo): mostrar el aviso en amarillo. */
  warning?: boolean;
  successId?: number;
};

async function companyId(): Promise<string> {
  const ids = await getCurrentUserCompanyIds();
  if (ids.length === 0) throw new Error("Tu usuario no está asignado a ninguna compañía.");
  return ids[0];
}

async function currentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

async function appOrigin(): Promise<string> {
  const h = await headers();
  return h.get("origin") ?? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
}

function newToken(): string {
  return randomBytes(32).toString("base64url"); // 43 caracteres, 256 bits
}

function surveyLink(origin: string, token: string): string {
  return `${origin}/encuesta/${token}`;
}

async function buildSnapshot(): Promise<SurveyQuestionSnapshot[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("survey_questions")
    .select("id, position, question_text, help_text, question_type, options, is_required, metric")
    .eq("is_active", true)
    .order("position")
    .order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []).map((q, i) => ({
    key: `q${i + 1}`,
    id: q.id,
    position: i + 1,
    text: q.question_text,
    help: q.help_text,
    type: q.question_type,
    options: Array.isArray(q.options) ? (q.options as string[]) : [],
    required: q.is_required,
    metric: q.metric,
  }));
}

export type RecipientInput = { name: string; email: string };

/**
 * Destinatario escrito por el usuario (viene prellenado con el contacto del
 * proyecto o del cliente, pero se puede cambiar antes de enviar). Correo
 * vacío = sin correo (se comparte el enlace).
 */
function parseRecipient(input: RecipientInput | undefined): { name: string | null; email: string | null } | { error: string } | undefined {
  if (!input) return undefined;
  const name = input.name.trim().slice(0, 150) || null;
  const email = input.email.trim().toLowerCase() || null;
  if (email && !z.string().email().safeParse(email).success) {
    return { error: "El correo del destinatario no es válido." };
  }
  return { name, email };
}

/** Manda (o reenvía) el correo de una encuesta y actualiza fechas/estado. */
async function deliverSurvey(surveyId: string, opts: { isResend: boolean; isReminder?: boolean }): Promise<SurveyActionState> {
  const supabase = await createClient();
  const { data: s, error } = await supabase
    .from("project_surveys")
    .select(
      "id, company_id, project_id, status, token, recipient_name, recipient_email, send_count, sent_at, projects(name, event_date), clients(name)",
    )
    .eq("id", surveyId)
    .single();
  if (error || !s) return { error: "No se encontró la encuesta." };
  if (s.status === "CANCELLED") return { error: "La encuesta está cancelada." };
  if (s.status === "ANSWERED") return { error: "El cliente ya respondió esta encuesta. Reábrela si necesitas que la responda de nuevo." };

  const origin = await appOrigin();
  const link = surveyLink(origin, s.token);
  if (!s.recipient_email) {
    await supabase
      .from("project_surveys")
      .update({ last_send_error: "El cliente no tiene correo registrado." })
      .eq("id", s.id);
    return {
      error: null,
      success: "La encuesta quedó creada, pero el cliente no tiene correo. Copia el enlace y envíalo por WhatsApp u otra vía.",
      link,
      warning: true,
    };
  }

  const [{ data: company }, { data: settings }] = await Promise.all([
    supabase.from("companies").select("name, logo_url, brand_primary, brand_accent").single(),
    supabase.from("survey_settings").select("email_subject, email_message").maybeSingle(),
  ]);
  const project = (Array.isArray(s.projects) ? s.projects[0] : s.projects) as { name: string; event_date: string | null } | null;
  const client = (Array.isArray(s.clients) ? s.clients[0] : s.clients) as { name: string } | null;
  const values = {
    empresa: company?.name ?? "",
    proyecto: project?.name ?? null,
    cliente: client?.name ?? "",
    contacto: s.recipient_name ?? "",
  };
  const subject = fillPlaceholders(settings?.email_subject ?? "¿Cómo te fue con tu evento?", values);
  const message = fillPlaceholders(
    settings?.email_message ?? "Nos encantaría conocer tu opinión sobre el servicio.",
    values,
  );

  const ok = await sendMail({
    to: s.recipient_email,
    subject: opts.isReminder ? `Recordatorio: ${subject}` : subject,
    html: surveyEmailHtml({
      companyName: company?.name ?? "",
      logoUrl: company?.logo_url ?? null,
      brandPrimary: company?.brand_primary ?? null,
      brandAccent: company?.brand_accent ?? null,
      recipientName: s.recipient_name,
      projectName: project?.name ?? "",
      eventDate: project?.event_date ?? null,
      message,
      link,
      isReminder: opts.isReminder,
    }),
  });

  if (!ok) {
    await supabase
      .from("project_surveys")
      .update({ last_send_error: "No se pudo enviar el correo (revisa la configuración SMTP)." })
      .eq("id", s.id);
    return {
      error: null,
      success: "No se pudo enviar el correo. La encuesta quedó lista: copia el enlace y envíalo por otra vía.",
      link,
      warning: true,
    };
  }

  const now = new Date().toISOString();
  const userId = await currentUserId();
  const { error: upErr } = await supabase
    .from("project_surveys")
    .update({
      status: "SENT",
      sent_at: s.sent_at ?? now,
      last_sent_at: now,
      sent_by: userId,
      send_count: (s.send_count ?? 0) + 1,
      last_send_error: null,
    })
    .eq("id", s.id);
  if (upErr) return { error: upErr.message };

  await logAudit({
    companyId: s.company_id,
    action: opts.isResend ? "SURVEY_RESENT" : "SURVEY_SENT",
    entityType: "project",
    entityId: s.project_id,
    newValues: { survey_id: s.id, email: s.recipient_email },
  });

  return {
    error: null,
    success: opts.isResend
      ? `Encuesta reenviada a ${s.recipient_email}.`
      : `Encuesta enviada a ${s.recipient_email}.`,
    link,
  };
}

/** Crea una encuesta para el proyecto (sin enviarla). Devuelve su id. */
async function createSurvey(
  projectId: string,
  override?: { name: string | null; email: string | null },
): Promise<{ id: string } | { error: string }> {
  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, company_id, client_id")
    .eq("id", projectId)
    .single();
  if (!project) return { error: "No se encontró el proyecto." };

  const questions = await buildSnapshot();
  if (questions.length === 0) {
    return { error: "No hay preguntas activas. Configúralas en Configuración → Encuesta de satisfacción." };
  }
  const recipient = await resolveSurveyRecipient(projectId);
  const userId = await currentUserId();

  const { data: created, error } = await supabase
    .from("project_surveys")
    .insert({
      company_id: project.company_id,
      project_id: project.id,
      client_id: project.client_id,
      // Si el usuario cambió el correo, ya no es el del contacto guardado.
      contact_id: override && override.email !== recipient.email ? null : recipient.contactId,
      recipient_name: override ? override.name : recipient.name,
      recipient_email: override ? override.email : recipient.email,
      token: newToken(),
      status: "PENDING",
      questions,
      created_by: userId,
    })
    .select("id")
    .single();
  if (error || !created) return { error: error?.message ?? "No se pudo crear la encuesta." };

  await logAudit({
    companyId: project.company_id,
    action: "SURVEY_CREATED",
    entityType: "project",
    entityId: project.id,
    newValues: { survey_id: created.id, email: recipient.email, questions: questions.length },
  });
  return { id: created.id };
}

function revalidateProject(projectId: string) {
  revalidatePath(`/projects/${projectId}`);
}

/**
 * Cierra el proyecto (estado COMPLETED) y, si se pidió, crea y envía la
 * encuesta. El proyecto se finaliza aunque la encuesta falle: el aviso
 * explica qué pasó y la pestaña "Satisfacción" permite reintentar.
 */
export async function completeProjectAction(
  projectId: string,
  _prev: SurveyActionState,
  formData: FormData,
): Promise<SurveyActionState> {
  await requirePermission("projects.update");
  const sendSurvey = formData.get("send_survey") === "on";
  const recipient = sendSurvey
    ? parseRecipient({
        name: String(formData.get("recipient_name") ?? ""),
        email: String(formData.get("recipient_email") ?? ""),
      })
    : undefined;
  if (recipient && "error" in recipient) return { error: recipient.error };

  const supabase = await createClient();
  const { data: project } = await supabase.from("projects").select("status, company_id").eq("id", projectId).single();
  if (!project) return { error: "No se encontró el proyecto." };

  if (project.status !== "COMPLETED") {
    const { error } = await supabase.from("projects").update({ status: "COMPLETED" }).eq("id", projectId);
    if (error) return { error: error.message };
    await logAudit({
      companyId: project.company_id,
      action: "STATUS_COMPLETED",
      entityType: "project",
      entityId: projectId,
      newValues: { status: "COMPLETED", send_survey: sendSurvey },
    });
    revalidatePath("/projects");
  }

  if (!sendSurvey) {
    revalidateProject(projectId);
    return { error: null, success: "Proyecto finalizado.", successId: Date.now() };
  }

  const canSend = await hasSendPermission();
  if (!canSend) {
    revalidateProject(projectId);
    return {
      error: null,
      success: "Proyecto finalizado. No tienes permiso para enviar encuestas; pídele a un administrador que la envíe.",
      successId: Date.now(),
    };
  }

  const created = await createSurvey(projectId, recipient);
  if ("error" in created) {
    revalidateProject(projectId);
    return {
      error: null,
      success: `Proyecto finalizado. La encuesta no se creó: ${created.error}`,
      warning: true,
      successId: Date.now(),
    };
  }
  const sent = await deliverSurvey(created.id, { isResend: false });
  revalidateProject(projectId);
  return {
    error: null,
    success: sent.error ? `Proyecto finalizado. ${sent.error}` : `Proyecto finalizado. ${sent.success ?? ""}`.trim(),
    link: sent.link ?? null,
    warning: Boolean(sent.error || sent.warning),
    successId: Date.now(),
  };
}

async function hasSendPermission(): Promise<boolean> {
  try {
    await requirePermission("surveys.send");
    return true;
  } catch {
    return false;
  }
}

/** Crea y envía una encuesta nueva desde la pestaña "Satisfacción". */
export async function sendNewSurveyAction(projectId: string, input?: RecipientInput): Promise<SurveyActionState> {
  await requirePermission("surveys.send");
  const recipient = parseRecipient(input);
  if (recipient && "error" in recipient) return { error: recipient.error };
  const created = await createSurvey(projectId, recipient);
  if ("error" in created) return { error: created.error };
  const sent = await deliverSurvey(created.id, { isResend: false });
  revalidateProject(projectId);
  return { ...sent, successId: Date.now() };
}

/** Reenvía el mismo enlace (no crea otra encuesta). */
export async function resendSurveyAction(
  surveyId: string,
  projectId: string,
  input?: RecipientInput,
): Promise<SurveyActionState> {
  await requirePermission("surveys.send");
  const recipient = parseRecipient(input);
  if (recipient && "error" in recipient) return { error: recipient.error };
  if (recipient) {
    // Corregir el destinatario antes de reenviar (mismo enlace).
    const supabase = await createClient();
    const { data: current } = await supabase
      .from("project_surveys")
      .select("company_id, status, recipient_email, recipient_name")
      .eq("id", surveyId)
      .single();
    if (!current) return { error: "No se encontró la encuesta." };
    if (current.status !== "PENDING" && current.status !== "SENT") {
      return { error: "Solo se puede cambiar el destinatario de una encuesta pendiente o enviada." };
    }
    if (current.recipient_email !== recipient.email || current.recipient_name !== recipient.name) {
      const { error } = await supabase
        .from("project_surveys")
        .update({
          recipient_name: recipient.name,
          recipient_email: recipient.email,
          ...(current.recipient_email !== recipient.email ? { contact_id: null } : {}),
        })
        .eq("id", surveyId);
      if (error) return { error: error.message };
      await logAudit({
        companyId: current.company_id,
        action: "SURVEY_RECIPIENT_CHANGED",
        entityType: "project",
        entityId: projectId,
        oldValues: { email: current.recipient_email, name: current.recipient_name },
        newValues: { survey_id: surveyId, email: recipient.email, name: recipient.name },
      });
    }
  }
  const res = await deliverSurvey(surveyId, { isResend: true });
  revalidateProject(projectId);
  return { ...res, successId: Date.now() };
}

export async function cancelSurveyAction(surveyId: string, projectId: string): Promise<SurveyActionState> {
  await requirePermission("surveys.send");
  const supabase = await createClient();
  const { data: s } = await supabase.from("project_surveys").select("status, company_id").eq("id", surveyId).single();
  if (!s) return { error: "No se encontró la encuesta." };
  if (s.status === "ANSWERED") return { error: "No se puede cancelar una encuesta ya respondida." };
  if (s.status === "CANCELLED") return { error: "La encuesta ya estaba cancelada." };
  const { error } = await supabase
    .from("project_surveys")
    .update({ status: "CANCELLED", cancelled_at: new Date().toISOString(), cancelled_by: await currentUserId() })
    .eq("id", surveyId);
  if (error) return { error: error.message };
  await logAudit({
    companyId: s.company_id,
    action: "SURVEY_CANCELLED",
    entityType: "project",
    entityId: projectId,
    newValues: { survey_id: surveyId },
  });
  revalidateProject(projectId);
  return { error: null, success: "Encuesta cancelada. El enlace ya no acepta respuestas.", successId: Date.now() };
}

/**
 * Reabre una encuesta respondida (o cancelada) para que el cliente pueda
 * responder otra vez con el mismo enlace. Las respuestas anteriores se
 * conservan hasta que llegue la nueva respuesta, que las reemplaza.
 */
export async function reopenSurveyAction(surveyId: string, projectId: string): Promise<SurveyActionState> {
  await requirePermission("surveys.send");
  const supabase = await createClient();
  const { data: s } = await supabase.from("project_surveys").select("status, company_id").eq("id", surveyId).single();
  if (!s) return { error: "No se encontró la encuesta." };
  if (s.status !== "ANSWERED" && s.status !== "CANCELLED") return { error: "Solo se reabren encuestas respondidas o canceladas." };
  const { error } = await supabase
    .from("project_surveys")
    .update({
      status: "SENT",
      reopened_at: new Date().toISOString(),
      reopened_by: await currentUserId(),
      cancelled_at: null,
      cancelled_by: null,
    })
    .eq("id", surveyId);
  if (error) return { error: error.message };
  await logAudit({
    companyId: s.company_id,
    action: "SURVEY_REOPENED",
    entityType: "project",
    entityId: projectId,
    newValues: { survey_id: surveyId, previous_status: s.status },
  });
  revalidateProject(projectId);
  return {
    error: null,
    success: "Encuesta reabierta. El cliente puede responder de nuevo con el mismo enlace (puedes reenviarle el correo).",
    successId: Date.now(),
  };
}

// ───────────────────────── Configuración ─────────────────────────

export async function updateSurveySettingsAction(_prev: SurveyActionState, formData: FormData): Promise<SurveyActionState> {
  await requirePermission("surveys.manage");
  const parsed = settingsSchema.safeParse({
    send_by_default: formData.get("send_by_default") === "on",
    send_delay_hours: formData.get("send_delay_hours") ?? 0,
    reminder_enabled: formData.get("reminder_enabled") === "on",
    reminder_after_days: formData.get("reminder_after_days") ?? 3,
    max_reminders: formData.get("max_reminders") ?? 1,
    email_subject: String(formData.get("email_subject") ?? ""),
    email_message: String(formData.get("email_message") ?? ""),
    survey_title: String(formData.get("survey_title") ?? ""),
    survey_intro: String(formData.get("survey_intro") ?? ""),
    thank_you_message: String(formData.get("thank_you_message") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };

  const cid = await companyId();
  const supabase = await createClient();
  const { error } = await supabase
    .from("survey_settings")
    .upsert({ company_id: cid, ...parsed.data, survey_intro: parsed.data.survey_intro ?? "" });
  if (error) return { error: error.message };
  revalidatePath("/settings/surveys");
  return { error: null, success: "Configuración guardada.", successId: Date.now() };
}

function parseQuestion(formData: FormData) {
  const options = String(formData.get("options") ?? "")
    .split("\n")
    .map((o) => o.trim())
    .filter(Boolean);
  return questionSchema.safeParse({
    question_text: String(formData.get("question_text") ?? ""),
    help_text: String(formData.get("help_text") ?? ""),
    question_type: String(formData.get("question_type") ?? ""),
    options,
    is_required: formData.get("is_required") === "on",
    metric: String(formData.get("metric") ?? ""),
  });
}

function questionError(message: string): string {
  if (message.includes("uq_survey_questions_single_metric")) {
    return "Ya hay otra pregunta que cuenta para ese indicador. Cada indicador (NPS, recomendación, testimonio, nombre) solo puede estar en una pregunta.";
  }
  return message;
}

export async function createSurveyQuestionAction(_prev: SurveyActionState, formData: FormData): Promise<SurveyActionState> {
  await requirePermission("surveys.manage");
  const parsed = parseQuestion(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const cid = await companyId();
  const supabase = await createClient();
  const { data: last } = await supabase
    .from("survey_questions")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const q = parsed.data;
  const { error } = await supabase.from("survey_questions").insert({
    company_id: cid,
    position: (last?.position ?? 0) + 1,
    question_text: q.question_text,
    help_text: q.help_text || null,
    question_type: q.question_type,
    options: ["SINGLE_CHOICE", "MULTIPLE_CHOICE"].includes(q.question_type) ? q.options : [],
    is_required: q.is_required,
    is_active: true,
    metric: q.metric || null,
  });
  if (error) return { error: questionError(error.message) };
  revalidatePath("/settings/surveys");
  return { error: null, success: "Pregunta agregada.", successId: Date.now() };
}

export async function updateSurveyQuestionAction(
  questionId: string,
  _prev: SurveyActionState,
  formData: FormData,
): Promise<SurveyActionState> {
  await requirePermission("surveys.manage");
  const parsed = parseQuestion(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const q = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("survey_questions")
    .update({
      question_text: q.question_text,
      help_text: q.help_text || null,
      question_type: q.question_type,
      options: ["SINGLE_CHOICE", "MULTIPLE_CHOICE"].includes(q.question_type) ? q.options : [],
      is_required: q.is_required,
      metric: q.metric || null,
    })
    .eq("id", questionId);
  if (error) return { error: questionError(error.message) };
  revalidatePath("/settings/surveys");
  return { error: null, success: "Pregunta guardada. Aplica a las encuestas que se envíen de ahora en adelante.", successId: Date.now() };
}

export async function toggleSurveyQuestionAction(questionId: string, field: "is_active" | "is_required"): Promise<void> {
  await requirePermission("surveys.manage");
  const supabase = await createClient();
  const { data: q } = await supabase.from("survey_questions").select("is_active, is_required").eq("id", questionId).single();
  if (!q) throw new Error("No se encontró la pregunta.");
  const { error } = await supabase
    .from("survey_questions")
    .update({ [field]: !q[field] })
    .eq("id", questionId);
  if (error) throw new Error(questionError(error.message));
  revalidatePath("/settings/surveys");
}

/** Sube o baja una pregunta un lugar (renumera todo para que quede 1..n). */
export async function moveSurveyQuestionAction(questionId: string, direction: "up" | "down"): Promise<void> {
  await requirePermission("surveys.manage");
  const supabase = await createClient();
  const { data } = await supabase.from("survey_questions").select("id, position").order("position").order("created_at");
  const list = data ?? [];
  const i = list.findIndex((q) => q.id === questionId);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  for (let k = 0; k < list.length; k++) {
    if (list[k].position !== k + 1) {
      const { error } = await supabase.from("survey_questions").update({ position: k + 1 }).eq("id", list[k].id);
      if (error) throw new Error(error.message);
    }
  }
  revalidatePath("/settings/surveys");
}

/**
 * Borra una pregunta. Si ya tiene respuestas, no se borra (se perdería el
 * vínculo para reportes): se desactiva y se avisa.
 */
export async function deleteSurveyQuestionAction(questionId: string): Promise<SurveyActionState> {
  await requirePermission("surveys.manage");
  const supabase = await createClient();
  const { count } = await supabase
    .from("project_survey_answers")
    .select("id", { count: "exact", head: true })
    .eq("question_id", questionId);
  if ((count ?? 0) > 0) {
    const { error } = await supabase.from("survey_questions").update({ is_active: false }).eq("id", questionId);
    if (error) return { error: error.message };
    revalidatePath("/settings/surveys");
    return {
      error: null,
      success: "Esta pregunta ya tiene respuestas, así que se desactivó en lugar de borrarse (se conserva para los reportes).",
      successId: Date.now(),
    };
  }
  const { error } = await supabase.from("survey_questions").delete().eq("id", questionId);
  if (error) return { error: error.message };
  revalidatePath("/settings/surveys");
  return { error: null, success: "Pregunta eliminada.", successId: Date.now() };
}
