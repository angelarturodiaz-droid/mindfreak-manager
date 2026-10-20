"use client";

import { startTransition, useActionState } from "react";
import { Input, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useSuccessToast } from "@/components/ui/use-success-toast";
import { updateSurveySettingsAction, type SurveyActionState } from "@/features/surveys/actions";

type Settings = {
  send_by_default: boolean;
  send_delay_hours: number;
  reminder_enabled: boolean;
  reminder_after_days: number;
  max_reminders: number;
  email_subject: string;
  email_message: string;
  survey_title: string;
  survey_intro: string;
  thank_you_message: string;
  whatsapp_message: string;
};


export function SurveySettingsForm({ settings, canManage }: { settings: Settings; canManage: boolean }) {
  const [state, formAction, pending] = useActionState<SurveyActionState, FormData>(updateSurveySettingsAction, {
    error: null,
  });
  useSuccessToast({ success: state.success ?? undefined, successId: state.successId });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
      className="flex flex-col gap-6"
    >

      <Card className="flex flex-col gap-4">
        <div>
          <h3 className="font-semibold text-brand-text">Lo que recibe el cliente</h3>
          <p className="text-xs text-brand-muted">
            Puedes usar {"{cliente}"}, {"{proyecto}"}, {"{empresa}"} y {"{contacto}"} (y {"{enlace}"} en WhatsApp); se
            reemplazan por los datos de cada proyecto.
          </p>
        </div>
        <Input label="Asunto del correo" name="email_subject" required defaultValue={settings.email_subject} disabled={!canManage} />
        <Textarea label="Mensaje del correo" name="email_message" required rows={3} defaultValue={settings.email_message} disabled={!canManage} />
        <Textarea
          label="Mensaje de WhatsApp"
          name="whatsapp_message"
          required
          rows={3}
          defaultValue={settings.whatsapp_message}
          disabled={!canManage}
          hint="Debe incluir {enlace}, que se reemplaza por el enlace de la encuesta."
        />
        <Input label="Título de la encuesta" name="survey_title" required defaultValue={settings.survey_title} disabled={!canManage} />
        <Textarea
          label="Introducción de la encuesta"
          name="survey_intro"
          rows={2}
          defaultValue={settings.survey_intro}
          disabled={!canManage}
        />
        <Textarea
          label="Mensaje de agradecimiento"
          name="thank_you_message"
          required
          rows={2}
          defaultValue={settings.thank_you_message}
          disabled={!canManage}
          hint="Se muestra al cliente cuando termina de responder."
        />
      </Card>

      {state.error && <p className="text-sm text-brand-danger">{state.error}</p>}
      {canManage && (
        <div>
          <Button type="submit" loading={pending}>
            Guardar mensajes
          </Button>
        </div>
      )}
    </form>
  );
}
