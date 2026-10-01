import { createClient } from "@/lib/supabase/server";

export async function listSurveyQuestions() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("survey_questions")
    .select("id, position, question_text, help_text, question_type, options, is_required, is_active, metric, updated_at")
    .order("position")
    .order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []).map((q) => ({ ...q, options: Array.isArray(q.options) ? (q.options as string[]) : [] }));
}

export async function getSurveySettings() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("survey_settings").select("*").maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/** Todas las encuestas del proyecto (la más reciente primero). */
export async function listProjectSurveys(projectId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_surveys")
    .select(
      "id, status, token, recipient_name, recipient_email, created_at, sent_at, last_sent_at, send_count, last_send_error, first_opened_at, responded_at, respondent_name, overall_rating, nps_score, recommendation, comments, testimonial_consent, reopened_at, cancelled_at, created_by_profile:profiles!project_surveys_created_by_fkey(full_name), sent_by_profile:profiles!project_surveys_sent_by_fkey(full_name)",
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listSurveyAnswers(surveyId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_survey_answers")
    .select("id, position, question_text, question_type, metric, value_text, value_number, value_options")
    .eq("survey_id", surveyId)
    .order("position");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export type SurveyRecipient = {
  contactId: string | null;
  name: string | null;
  email: string | null;
  source: "project_contact" | "primary_contact" | "client" | "none";
};

/**
 * A quién se le manda la encuesta: el contacto del proyecto; si no tiene
 * correo, el contacto principal del cliente con correo; si no, el correo
 * del cliente.
 */
export async function resolveSurveyRecipient(projectId: string): Promise<SurveyRecipient> {
  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("client_id, contact_id, clients(name, email)")
    .eq("id", projectId)
    .single();
  if (!project) return { contactId: null, name: null, email: null, source: "none" };

  if (project.contact_id) {
    const { data: c } = await supabase
      .from("client_contacts")
      .select("id, full_name, email")
      .eq("id", project.contact_id)
      .maybeSingle();
    if (c?.email) return { contactId: c.id, name: c.full_name, email: c.email, source: "project_contact" };
  }

  const { data: contacts } = await supabase
    .from("client_contacts")
    .select("id, full_name, email, is_primary")
    .eq("client_id", project.client_id)
    .not("email", "is", null)
    .order("is_primary", { ascending: false })
    .order("created_at");
  const best = (contacts ?? []).find((c) => c.email);
  if (best) return { contactId: best.id, name: best.full_name, email: best.email, source: "primary_contact" };

  const client = (Array.isArray(project.clients) ? project.clients[0] : project.clients) as { name: string; email: string | null } | null;
  if (client?.email) return { contactId: null, name: client.name, email: client.email, source: "client" };
  return { contactId: null, name: client?.name ?? null, email: null, source: "none" };
}
