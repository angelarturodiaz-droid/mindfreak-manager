import { getSurveySettings, listSurveyQuestions } from "@/features/surveys/queries";
import { hasPermission } from "@/lib/auth/permissions";
import { SurveySettingsForm } from "./survey-settings-form";
import { SurveyQuestionsManager } from "./survey-questions-manager";

/**
 * Configuración → Encuesta de satisfacción: textos del correo y de la
 * página pública, si se ofrece enviarla por defecto al finalizar un
 * proyecto, y las preguntas (agregar, editar, desactivar, ordenar,
 * obligatoria u opcional).
 */
export default async function SurveySettingsPage() {
  const [settings, questions, canManage] = await Promise.all([
    getSurveySettings(),
    listSurveyQuestions(),
    hasPermission("surveys.manage"),
  ]);

  return (
    <div className="flex max-w-4xl flex-col gap-8">
      <div>
        <h2 className="text-lg font-semibold text-brand-primary">Encuesta de satisfacción</h2>
        <p className="text-sm text-brand-muted">
          Se ofrece al finalizar un proyecto y el cliente la responde desde un enlace seguro, sin cuenta. Los cambios
          aplican a las encuestas que se envíen de ahora en adelante; las ya enviadas conservan sus preguntas.
        </p>
      </div>

      <SurveyQuestionsManager questions={questions} canManage={canManage} />

      {settings && <SurveySettingsForm settings={settings} canManage={canManage} />}
    </div>
  );
}
