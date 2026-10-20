"use client";

import { startTransition, useActionState, useState } from "react";
import { Input, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InfoHint } from "@/components/ui/info-hint";
import { ResultDialog } from "@/components/ui/result-dialog";
import { useSuccessToast } from "@/components/ui/use-success-toast";
import { saveInvoiceMessagesAction, type ReminderSettingsState } from "@/features/reminders/actions";

const VARIABLES =
  "Se reemplazan solas: {cliente} (nombre del cliente), {contacto} (primer nombre del contacto de cobros o principal), {factura} (número), {monto} (lo pendiente, con moneda), {vence} (fecha de vencimiento), {cuando} (ej. «vence hoy», «venció hace 10 días») y {empresa}.";

/** Mensajes al cliente → Facturación: lo que dice el recordatorio de cobro. */
export function InvoiceMessagesForm({
  settings,
}: {
  settings: { invoice_subject: string; invoice_message: string; whatsapp_message: string };
}) {
  const [state, formAction, pending] = useActionState<ReminderSettingsState, FormData>(saveInvoiceMessagesAction, {
    error: null,
  });
  useSuccessToast({ success: state.success, successId: state.successId });
  const [dismissed, setDismissed] = useState<ReminderSettingsState | null>(null);
  const errorOpen = Boolean(state.error) && dismissed !== state;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
    >
      <Card className="flex flex-col gap-4">
        <div>
          <h3 className="flex items-center gap-1.5 font-semibold text-brand-text">
            Recordatorio de cobro
            <InfoHint text={VARIABLES} />
          </h3>
          <p className="text-xs text-brand-muted">
            Puedes usar {"{cliente}"}, {"{contacto}"}, {"{factura}"}, {"{monto}"}, {"{vence}"}, {"{cuando}"} y {"{empresa}"}.
            El correo agrega solo el resumen de la factura y sus datos bancarios. Para ver cómo queda: Recordatorios → «Ver
            qué sale hoy» → «Ver correo».
          </p>
        </div>
        <Input label="Asunto del correo" name="invoice_subject" required defaultValue={settings.invoice_subject} />
        <Textarea label="Mensaje del correo" name="invoice_message" required rows={3} defaultValue={settings.invoice_message} />
        <Textarea
          label="Mensaje de WhatsApp"
          name="whatsapp_message"
          required
          rows={3}
          defaultValue={settings.whatsapp_message}
          hint="Se usa en la lista «Para recordar hoy por WhatsApp» de Facturas: el botón abre el chat con este mensaje ya escrito."
        />
        <div className="border-t border-brand-border pt-4">
          <Button type="submit" loading={pending}>
            Guardar mensajes
          </Button>
        </div>
      </Card>
      <ResultDialog open={errorOpen} tone="danger" title="No se guardó" onClose={() => setDismissed(state)}>
        {state.error}
      </ResultDialog>
    </form>
  );
}
