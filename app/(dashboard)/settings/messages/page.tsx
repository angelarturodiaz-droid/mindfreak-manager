import Link from "next/link";
import { getSurveySettings, listSurveyQuestions } from "@/features/surveys/queries";
import { getReminderSettings } from "@/features/reminders/queries";
import { hasPermission } from "@/lib/auth/permissions";
import { Card } from "@/components/ui/card";
import { InfoHint } from "@/components/ui/info-hint";
import { TypePicker } from "@/components/settings/type-picker";
import { SurveySettingsForm } from "../surveys/survey-settings-form";
import { SurveyQuestionsManager } from "../surveys/survey-questions-manager";
import { InvoiceMessagesForm } from "./invoice-messages-form";

const TYPES = [
  { value: "encuesta", label: "Encuesta de satisfacción" },
  { value: "facturacion", label: "Facturación (recordatorio de cobro)" },
  { value: "cotizaciones", label: "Cotizaciones", soon: true },
];

/**
 * Configuración → Mensajes al cliente: TODO lo que recibe o ve el cliente,
 * por tipo (lista desplegable). Cuándo se envía cada cosa está en
 * Configuración → Recordatorios.
 */
export default async function MessagesSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string }>;
}) {
  const sp = await searchParams;
  const tipo = TYPES.some((t) => t.value === sp.tipo) ? sp.tipo! : "encuesta";
  const [survey, questions, canManageSurvey, reminders] = await Promise.all([
    tipo === "encuesta" ? getSurveySettings() : Promise.resolve(null),
    tipo === "encuesta" ? listSurveyQuestions() : Promise.resolve([]),
    hasPermission("surveys.manage"),
    tipo === "facturacion" ? getReminderSettings() : Promise.resolve(null),
  ]);

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-brand-primary">
          Mensajes al cliente
          <InfoHint text="Aquí se escribe lo que recibe o ve el cliente: correos, mensajes de WhatsApp y, en la encuesta, sus preguntas y textos. Cuándo se envía cada cosa (encendido, días, horario) está en Configuración → Recordatorios." />
        </h2>
        <p className="text-sm text-brand-muted">
          Lo que recibe el cliente. Cuándo se envía está en{" "}
          <Link href={`/settings/reminders?tipo=${tipo === "facturacion" ? "facturas" : tipo}`} className="text-brand-accent hover:underline">
            Recordatorios
          </Link>
          .
        </p>
      </div>

      <TypePicker
        label="¿Qué mensajes quieres editar?"
        hint="Elige el tipo y abajo salen todos sus textos. Cuando se agreguen otros (ej. cotizaciones), aparecerán en esta misma lista."
        options={TYPES}
        value={tipo}
      />

      {tipo === "encuesta" && (
        <>
          <p className="text-sm text-brand-muted">
            Se ofrece al finalizar un proyecto y el cliente la responde desde un enlace seguro, sin cuenta. Los cambios
            aplican a las encuestas que se envíen de ahora en adelante; las ya enviadas conservan sus preguntas.
          </p>
          <SurveyQuestionsManager questions={questions} canManage={canManageSurvey} />
          {survey && <SurveySettingsForm settings={survey} canManage={canManageSurvey} />}
        </>
      )}
      {tipo === "facturacion" && reminders && (
        <InvoiceMessagesForm
          key={reminders.updated_at ?? "nuevo"}
          settings={{
            invoice_subject: reminders.invoice_subject,
            invoice_message: reminders.invoice_message,
            whatsapp_message: reminders.whatsapp_message,
          }}
        />
      )}
      {tipo === "cotizaciones" && (
        <Card className="text-sm text-brand-muted">
          <strong className="text-brand-text">Próximamente.</strong> Aquí irán los textos del recordatorio de cotización
          por vencer (correo y WhatsApp), con el mismo formato.
        </Card>
      )}
    </div>
  );
}
