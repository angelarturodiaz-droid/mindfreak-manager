import { createClient } from "@/lib/supabase/server";

/** Lo que devuelve get_public_survey (migración 068). Sin IDs internos. */
export type PublicSurvey = {
  status: "PENDING" | "SENT" | "ANSWERED" | "CANCELLED";
  responded_at: string | null;
  recipient_name: string | null;
  client_name: string;
  project: { name: string; event_date: string | null };
  company: {
    name: string;
    legal_name: string | null;
    logo_url: string | null;
    brand_primary: string | null;
    brand_accent: string | null;
    email: string | null;
    phone: string | null;
  };
  texts: { title: string; intro: string; thanks: string };
  questions: PublicQuestion[];
};

export type PublicQuestion = {
  key: string;
  text: string;
  help: string | null;
  type: string;
  options: string[];
  required: boolean;
  metric: string | null;
};

/** Valida la forma del token antes de ir a la base (43 caracteres base64url). */
export function looksLikeToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{32,128}$/.test(token);
}

/**
 * Lee la encuesta por su token. El visitante no tiene sesión: la consulta va
 * como "anon" a la función get_public_survey, que solo busca por token.
 */
export async function getPublicSurvey(token: string): Promise<PublicSurvey | null> {
  if (!looksLikeToken(token)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_survey", { p_token: token });
  if (error) {
    console.error("get_public_survey:", error.message);
    return null;
  }
  return (data as PublicSurvey | null) ?? null;
}
