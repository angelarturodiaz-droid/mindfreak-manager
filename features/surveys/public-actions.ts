"use server";

import { createClient } from "@/lib/supabase/server";
import { looksLikeToken } from "./public";

export type PublicSubmitState = {
  done: boolean;
  error: string | null;
  /** Texto de la pregunta con problema, para resaltarla. */
  question?: string | null;
};

const ERRORS: Record<string, string> = {
  not_found: "Este enlace no es válido o ya no existe.",
  invalid: "Hay una respuesta que no es válida. Revísala e intenta de nuevo.",
  already_answered: "Esta encuesta ya fue respondida. ¡Gracias!",
  cancelled: "Esta encuesta ya no está disponible.",
  required: "Falta responder una pregunta obligatoria.",
  too_long: "Una de las respuestas es demasiado larga.",
};

/**
 * Envía las respuestas de la encuesta pública. Sin sesión: todo lo valida
 * submit_public_survey en la base (token, estado, obligatorias, opciones).
 */
export async function submitPublicSurveyAction(
  token: string,
  _prev: PublicSubmitState,
  formData: FormData,
): Promise<PublicSubmitState> {
  if (!looksLikeToken(token)) return { done: false, error: ERRORS.not_found };

  let answers: unknown;
  try {
    answers = JSON.parse(String(formData.get("answers") ?? "{}"));
  } catch {
    return { done: false, error: ERRORS.invalid };
  }
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
    return { done: false, error: ERRORS.invalid };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_public_survey", { p_token: token, p_answers: answers });
  if (error) {
    console.error("submit_public_survey:", error.message);
    return { done: false, error: "No pudimos guardar tus respuestas. Intenta de nuevo en un momento." };
  }
  const res = data as { ok: boolean; error?: string; question?: string } | null;
  if (res?.ok) return { done: true, error: null };
  if (res?.error === "already_answered") return { done: true, error: null };
  return {
    done: false,
    error: ERRORS[res?.error ?? ""] ?? "No pudimos guardar tus respuestas.",
    question: res?.question ?? null,
  };
}
