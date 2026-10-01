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

function Toggle({ name, defaultChecked, label, hint, disabled }: { name: string; defaultChecked: boolean; label: string; hint?: string; disabled?: boolean }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} disabled={disabled} className="peer sr-only" />
      <span
        aria-hidden
        className="relative mt-0.5 h-5 w-9 shrink-0 rounded-full bg-brand-disabled transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition-all peer-checked:bg-brand-accent peer-checked:after:left-[18px] peer-focus-visible:ring-2 peer-focus-visible:ring-brand-accent"
      />
      <span className="flex flex-col">
        <span className="text-sm font-medium text-brand-text">{label}</span>
        {hint && <span className="text-xs text-brand-muted">{hint}</span>}
      </span>
    </label>
  );
}

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
          <h3 className="font-semibold text-brand-text">Envío</h3>
          <p className="text-xs text-brand-muted">Cómo se ofrece la encuesta al cerrar un proyecto.</p>
        </div>
        <Toggle
          name="send_by_default"
          defaultChecked={settings.send_by_default}
          disabled={!canManage}
          label="Activar el envío por defecto al finalizar un proyecto"
          hint="La pregunta “¿Deseas enviar la encuesta de satisfacción al cliente?” aparece marcada; se puede desmarcar en cada cierre."
        />

        <details className="rounded-[var(--radius-md)] border border-brand-border px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium text-brand-text">
            Automatización (próximamente)
          </summary>
          <p className="mt-2 text-xs text-brand-muted">
            Estos ajustes quedan guardados para cuando se active el envío programado. Por ahora la encuesta se envía al
            momento de finalizar el proyecto y los recordatorios se mandan con “Reenviar”.
          </p>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input
              label="Enviar después de (horas)"
              name="send_delay_hours"
              type="number"
              min={0}
              max={720}
              defaultValue={settings.send_delay_hours}
              disabled={!canManage}
            />
            <Input
              label="Recordar después de (días)"
              name="reminder_after_days"
              type="number"
              min={1}
              max={60}
              defaultValue={settings.reminder_after_days}
              disabled={!canManage}
            />
            <Input
              label="Máximo de recordatorios"
              name="max_reminders"
              type="number"
              min={0}
              max={5}
              defaultValue={settings.max_reminders}
              disabled={!canManage}
            />
          </div>
          <div className="mt-3">
            <Toggle
              name="reminder_enabled"
              defaultChecked={settings.reminder_enabled}
              disabled={!canManage}
              label="Recordatorios automáticos"
            />
          </div>
        </details>
      </Card>

      <Card className="flex flex-col gap-4">
        <div>
          <h3 className="font-semibold text-brand-text">Textos</h3>
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
            Guardar configuración
          </Button>
        </div>
      )}
    </form>
  );
}
