import type { Metadata } from "next";
import { getPublicSurvey } from "@/features/surveys/public";
import { SurveyPageView } from "./survey-view";

/**
 * Encuesta de satisfacción pública (/encuesta/{token}). Fuera del panel:
 * el cliente no inicia sesión y la URL solo lleva el token aleatorio.
 * Diseño mobile-first con los colores y el logo de la empresa.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Encuesta de satisfacción",
  robots: { index: false, follow: false },
};

export default async function PublicSurveyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const survey = await getPublicSurvey(token);
  return <SurveyPageView survey={survey} token={token} />;
}
