import { z } from "zod";

/**
 * Encuesta de satisfacción de clientes (migración 068). Las preguntas viven
 * en `survey_questions` (Configuración → Encuesta de satisfacción); al crear
 * una encuesta se copia la lista activa en `project_surveys.questions`.
 */

export const SURVEY_STATUSES = ["PENDING", "SENT", "ANSWERED", "CANCELLED"] as const;

export const SURVEY_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  SENT: "Enviada",
  ANSWERED: "Respondida",
  CANCELLED: "Cancelada",
};

export const SURVEY_STATUS_TONE: Record<string, "warning" | "info" | "success" | "danger" | "neutral"> = {
  PENDING: "warning",
  SENT: "info",
  ANSWERED: "success",
  CANCELLED: "danger",
};

export const QUESTION_TYPES = ["RATING_5", "NPS_10", "SHORT_TEXT", "LONG_TEXT", "SINGLE_CHOICE", "MULTIPLE_CHOICE", "YES_NO"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const QUESTION_TYPE_LABELS: Record<string, string> = {
  RATING_5: "Calificación de 1 a 5",
  NPS_10: "Escala de 0 a 10 (NPS)",
  SHORT_TEXT: "Respuesta corta",
  LONG_TEXT: "Párrafo",
  SINGLE_CHOICE: "Opción única",
  MULTIPLE_CHOICE: "Varias opciones",
  YES_NO: "Sí / No",
};

export const QUESTION_METRICS = ["RATING", "NPS", "RECOMMENDATION", "COMMENT", "TESTIMONIAL_CONSENT", "RESPONDENT_NAME"] as const;

/** Para qué indicador cuenta la respuesta (reportes). */
export const METRIC_LABELS: Record<string, string> = {
  RATING: "Cuenta para la calificación general",
  NPS: "NPS",
  RECOMMENDATION: "Recomendación",
  COMMENT: "Comentarios",
  TESTIMONIAL_CONSENT: "Autoriza testimonio",
  RESPONDENT_NAME: "Nombre de quien responde",
};

/** Indicadores válidos según el tipo de pregunta. */
export const METRICS_BY_TYPE: Record<string, string[]> = {
  RATING_5: ["RATING"],
  NPS_10: ["NPS"],
  SHORT_TEXT: ["RESPONDENT_NAME", "COMMENT"],
  LONG_TEXT: ["COMMENT"],
  SINGLE_CHOICE: ["RECOMMENDATION"],
  MULTIPLE_CHOICE: [],
  YES_NO: ["TESTIMONIAL_CONSENT"],
};

export const CHOICE_TYPES = ["SINGLE_CHOICE", "MULTIPLE_CHOICE"];

export type SurveyQuestionSnapshot = {
  key: string;
  id: string;
  position: number;
  text: string;
  help: string | null;
  type: string;
  options: string[];
  required: boolean;
  metric: string | null;
};

export const questionSchema = z
  .object({
    question_text: z.string().trim().min(3, "Escribe la pregunta.").max(300),
    help_text: z.string().trim().max(300).optional().or(z.literal("")),
    question_type: z.enum(QUESTION_TYPES),
    options: z.array(z.string().trim().min(1).max(120)).max(12).default([]),
    is_required: z.boolean().default(false),
    metric: z.enum(QUESTION_METRICS).optional().or(z.literal("")),
  })
  .superRefine((q, ctx) => {
    if (CHOICE_TYPES.includes(q.question_type)) {
      const unique = new Set(q.options.map((o) => o.toLowerCase()));
      if (q.options.length < 2) ctx.addIssue({ code: "custom", message: "Agrega al menos dos opciones." });
      else if (unique.size !== q.options.length) ctx.addIssue({ code: "custom", message: "Hay opciones repetidas." });
    }
    if (q.metric && !(METRICS_BY_TYPE[q.question_type] ?? []).includes(q.metric)) {
      ctx.addIssue({ code: "custom", message: "Ese indicador no corresponde a este tipo de pregunta." });
    }
  });

export const settingsSchema = z.object({
  send_by_default: z.boolean(),
  send_delay_hours: z.coerce.number().int().min(0).max(720),
  reminder_enabled: z.boolean(),
  reminder_after_days: z.coerce.number().int().min(1).max(60),
  max_reminders: z.coerce.number().int().min(0).max(5),
  email_subject: z.string().trim().min(3, "Escribe el asunto del correo.").max(160),
  email_message: z.string().trim().min(3, "Escribe el mensaje del correo.").max(1500),
  survey_title: z.string().trim().min(3, "Escribe el título de la encuesta.").max(120),
  survey_intro: z.string().trim().max(800).optional().or(z.literal("")),
  thank_you_message: z.string().trim().min(3, "Escribe el mensaje de gracias.").max(500),
});

/** Reemplaza {cliente}, {proyecto}, {empresa} y {contacto} en los textos configurables. */
export function fillPlaceholders(
  text: string,
  values: { cliente?: string | null; proyecto?: string | null; empresa?: string | null; contacto?: string | null },
): string {
  return text
    .replaceAll("{cliente}", values.cliente ?? "")
    .replaceAll("{proyecto}", values.proyecto ?? "tu evento")
    .replaceAll("{empresa}", values.empresa ?? "")
    .replaceAll("{contacto}", values.contacto ?? "");
}

/** Etiqueta del NPS: Promotor (9–10), Pasivo (7–8), Detractor (0–6). */
export function npsCategory(score: number | null | undefined): { label: string; tone: "success" | "warning" | "danger" } | null {
  if (score === null || score === undefined) return null;
  if (score >= 9) return { label: "Promotor", tone: "success" };
  if (score >= 7) return { label: "Pasivo", tone: "warning" };
  return { label: "Detractor", tone: "danger" };
}
