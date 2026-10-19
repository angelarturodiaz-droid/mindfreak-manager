"use client";

import { startTransition, useActionState, useState } from "react";
import { Plus, X } from "lucide-react";
import { Input, Select, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InfoHint } from "@/components/ui/info-hint";
import { Tooltip } from "@/components/ui/tooltip";
import { ResultDialog } from "@/components/ui/result-dialog";
import { useSuccessToast } from "@/components/ui/use-success-toast";
import { saveReminderSettingsAction, type ReminderSettingsState } from "@/features/reminders/actions";
import { normalizeDays, stepLabel } from "@/features/reminders/schedule";

type Settings = {
  auto_send_enabled: boolean;
  invoice_days: number[];
  invoice_subject: string;
  invoice_message: string;
  whatsapp_message: string;
};

const VARIABLES =
  "Variables que se reemplazan solas: {cliente} (nombre del cliente), {contacto} (primer nombre del contacto), {factura} (número), {monto} (lo pendiente, con moneda), {vence} (fecha de vencimiento), {cuando} (ej. «vence hoy», «venció hace 10 días») y {empresa}.";

export function ReminderSettingsForm({ settings }: { settings: Settings }) {
  const [state, formAction, pending] = useActionState<ReminderSettingsState, FormData>(saveReminderSettingsAction, {
    error: null,
  });
  useSuccessToast({ success: state.success, successId: state.successId });
  const [days, setDays] = useState<number[]>(normalizeDays(settings.invoice_days));
  const [enabled, setEnabled] = useState(settings.auto_send_enabled);
  const [newAmount, setNewAmount] = useState("5");
  const [newWhen, setNewWhen] = useState<"before" | "on" | "after">("after");
  const [problem, setProblem] = useState<string | null>(null);
  // Error del servidor → ventana emergente (no texto suelto); se cierra hasta el próximo guardado.
  const [dismissed, setDismissed] = useState<ReminderSettingsState | null>(null);
  const errorOpen = Boolean(state.error) && dismissed !== state;

  function addDay() {
    const n = Math.trunc(Number(newAmount));
    if (newWhen !== "on" && (!Number.isFinite(n) || n < 1)) {
      setProblem("Escribe cuántos días (1 o más).");
      return;
    }
    const value = newWhen === "on" ? 0 : newWhen === "before" ? -n : n;
    if (value < -60 || value > 120) {
      setProblem("El recordatorio debe estar entre 60 días antes y 120 días después del vencimiento.");
      return;
    }
    if (days.includes(value)) {
      setProblem(`Ya hay un recordatorio «${stepLabel(value)}».`);
      return;
    }
    if (days.length >= 10) {
      setProblem("Puedes tener hasta 10 recordatorios por factura.");
      return;
    }
    setDays(normalizeDays([...days, value]));
  }

  function removeDay(d: number) {
    if (days.length <= 1) {
      setProblem("Deja al menos un recordatorio. Si no quieres enviar ninguno, apaga los envíos automáticos.");
      return;
    }
    setDays(days.filter((x) => x !== d));
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
      className="flex flex-col gap-6"
    >
      <input type="hidden" name="invoice_days" value={days.join(",")} />

      <Card className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-1.5 font-semibold text-brand-text">
              Envíos automáticos por correo
              <InfoHint text="Si está encendido, cada día a las 8:15 a. m. el sistema revisa las facturas abiertas y las encuestas sin responder, y les manda el correo al cliente cuando toca. Cada envío queda en la Gestión de cobro de la factura y en la campana del responsable. Apagado = no sale ningún correo a clientes (la lista de WhatsApp sigue funcionando)." />
            </h3>
            <p className="text-xs text-brand-muted">Facturas por vencer o vencidas y encuestas sin responder.</p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
              enabled ? "bg-brand-success-bg text-brand-success" : "bg-brand-surface-hover text-brand-muted"
            }`}
          >
            {enabled ? "Encendido · 8:15 a. m." : "Apagado"}
          </span>
        </div>
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            name="auto_send_enabled"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="peer sr-only"
          />
          <span
            aria-hidden
            className="relative mt-0.5 h-5 w-9 shrink-0 rounded-full bg-brand-disabled transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition-all peer-checked:bg-brand-accent peer-checked:after:left-[18px] peer-focus-visible:ring-2 peer-focus-visible:ring-brand-accent"
          />
          <span className="flex flex-col">
            <span className="text-sm font-medium text-brand-text">Enviar los recordatorios a los clientes</span>
            <span className="text-xs text-brand-muted">
              A los contactos del cliente marcados «Recibe recordatorios de cobro» (ej. el contable) o, si no hay, al
              correo del cliente. Solo facturas emitidas, contando desde su vencimiento. Enciéndelo cuando trabajes con
              clientes reales.
            </span>
          </span>
        </label>
      </Card>

      <Card className="flex flex-col gap-4">
        <div>
          <h3 className="flex items-center gap-1.5 font-semibold text-brand-text">
            Cuándo se recuerda una factura
            <InfoHint text="Días respecto a la fecha de vencimiento de cada factura emitida que todavía tiene balance. Si la factura es de un proyecto, pon un vencimiento posterior al cierre del evento (la factura te avisa con la fecha del evento). Cada recordatorio sale una sola vez. Si el sistema no pudo revisar algún día, lo recupera hasta 2 días tarde. Las facturas pagadas, canceladas o en borrador no reciben recordatorios." />
          </h3>
          <p className="text-xs text-brand-muted">Por defecto: 3 días antes, el día que vence y 10 días después.</p>
        </div>
        <ul className="flex flex-wrap gap-2" aria-label="Recordatorios de factura">
          {days.map((d) => (
            <li
              key={d}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm ${
                d < 0
                  ? "border-brand-accent/30 bg-brand-accent-light text-brand-accent"
                  : d === 0
                    ? "border-brand-warning/40 bg-brand-warning-bg text-brand-warning"
                    : "border-brand-danger/30 bg-brand-danger-bg text-brand-danger"
              }`}
            >
              {stepLabel(d)}
              <Tooltip text="Quitar este recordatorio">
                <button
                  type="button"
                  onClick={() => removeDay(d)}
                  aria-label={`Quitar ${stepLabel(d)}`}
                  className="rounded-full p-0.5 hover:bg-black/5"
                >
                  <X size={13} />
                </button>
              </Tooltip>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-end gap-2">
          {newWhen !== "on" && (
            <div className="w-24">
              <Input
                label="Días"
                type="number"
                min={1}
                max={120}
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
              />
            </div>
          )}
          <div className="w-64">
            <Select label="Cuándo" value={newWhen} onChange={(e) => setNewWhen(e.target.value as typeof newWhen)}>
              <option value="before">antes del vencimiento</option>
              <option value="on">el día del vencimiento</option>
              <option value="after">después del vencimiento</option>
            </Select>
          </div>
          <Button type="button" variant="outline" icon={<Plus size={14} />} onClick={addDay}>
            Agregar recordatorio
          </Button>
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <div>
          <h3 className="flex items-center gap-1.5 font-semibold text-brand-text">
            Mensajes
            <InfoHint text={VARIABLES} />
          </h3>
          <p className="text-xs text-brand-muted">
            Puedes usar {"{cliente}"}, {"{contacto}"}, {"{factura}"}, {"{monto}"}, {"{vence}"}, {"{cuando}"} y {"{empresa}"}.
            El correo agrega solo el resumen de la factura y los datos bancarios que tenga.
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
          hint="Se usa en la lista «Para recordar hoy» de Facturas: el botón abre WhatsApp con este mensaje ya escrito."
        />
      </Card>

      <div>
        <Button type="submit" loading={pending}>
          Guardar cambios
        </Button>
      </div>

      <ResultDialog open={Boolean(problem)} tone="warning" title="Revisa el recordatorio" onClose={() => setProblem(null)}>
        {problem}
      </ResultDialog>
      <ResultDialog open={errorOpen} tone="danger" title="No se guardó" onClose={() => setDismissed(state)}>
        {state.error}
      </ResultDialog>
    </form>
  );
}
