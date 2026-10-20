"use client";

import Link from "next/link";
import { startTransition, useActionState, useState, useTransition } from "react";
import { MessageSquareText, Plus, X } from "lucide-react";
import { Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InfoHint } from "@/components/ui/info-hint";
import { Tooltip } from "@/components/ui/tooltip";
import { ResultDialog } from "@/components/ui/result-dialog";
import { useSuccessToast } from "@/components/ui/use-success-toast";
import {
  saveInvoiceReminderAction,
  saveSurveyReminderAction,
  setAutoSendAction,
  type ReminderSettingsState,
} from "@/features/reminders/actions";
import { normalizeDays, stepLabel } from "@/features/reminders/schedule";

/** Interruptor visual (casilla con forma de botón deslizante). */
function Switch({
  name,
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  name?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <label className={`flex items-start gap-3 ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}>
      <input
        type="checkbox"
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
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

/** Error del servidor → ventana emergente que se cierra hasta el próximo guardado. */
function useErrorDialog(state: ReminderSettingsState) {
  const [dismissed, setDismissed] = useState<ReminderSettingsState | null>(null);
  return {
    open: Boolean(state.error) && dismissed !== state,
    close: () => setDismissed(state),
  };
}

/** "Descartar cambios": vuelve a lo guardado sin guardar nada. */
function DiscardButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      hint="Deja todo como estaba guardado. No se guarda nada."
    >
      Descartar cambios
    </Button>
  );
}

function MessagesLink({ tipo, label }: { tipo: string; label: string }) {
  return (
    <Link
      href={`/settings/messages?tipo=${tipo}`}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-accent hover:underline"
    >
      <MessageSquareText size={14} aria-hidden /> {label}
    </Link>
  );
}

// ───────────────────────────── Interruptor general

export function GeneralSwitch({ enabled: initial }: { enabled: boolean }) {
  const [enabled, setEnabled] = useState(initial);
  const [pending, startT] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle(next: boolean) {
    setEnabled(next);
    startT(async () => {
      const r = await setAutoSendAction(next);
      if (r.error) {
        setEnabled(!next);
        setError(r.error);
      }
    });
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <h3 className="flex items-center gap-1.5 font-semibold text-brand-text">
          Interruptor general
          <InfoHint text="Vale para todos los recordatorios por correo (facturas, encuesta y los que se agreguen). Apagado = no sale ningún correo a clientes, aunque cada tipo esté encendido. Se guarda al tocarlo." />
        </h3>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
            enabled ? "bg-brand-success-bg text-brand-success" : "bg-brand-surface-hover text-brand-muted"
          }`}
        >
          {enabled ? "Encendido" : "Apagado"}
        </span>
      </div>
      <Switch
        checked={enabled}
        onChange={toggle}
        disabled={pending}
        label="Enviar recordatorios por correo a los clientes"
        hint={
          <>
            Enciéndelo cuando trabajes con clientes reales. <strong>Cuándo salen:</strong> el sistema revisa{" "}
            <strong>una vez al día, a las 8:15 a. m.</strong> (hora de la revisión, no de cuando lo encendiste; funciona
            en producción). Mientras pruebas en tu computadora, usa «Enviar ahora» abajo.
          </>
        }
      />
      <ResultDialog open={Boolean(error)} tone="danger" title="No se guardó" onClose={() => setError(null)}>
        {error}
      </ResultDialog>
    </Card>
  );
}

// ───────────────────────────── Facturas por cobrar

type InvoiceReminderSettings = { invoice_enabled: boolean; invoice_days: number[] };

export function InvoiceReminderForm({ settings }: { settings: InvoiceReminderSettings }) {
  const [k, setK] = useState(0);
  return <InvoiceReminderFormInner key={k} settings={settings} onDiscard={() => setK(k + 1)} />;
}

function InvoiceReminderFormInner({ settings, onDiscard }: { settings: InvoiceReminderSettings; onDiscard: () => void }) {
  const [state, formAction, pending] = useActionState<ReminderSettingsState, FormData>(saveInvoiceReminderAction, {
    error: null,
  });
  useSuccessToast({ success: state.success, successId: state.successId });
  const err = useErrorDialog(state);
  const [on, setOn] = useState(settings.invoice_enabled);
  const [days, setDays] = useState<number[]>(normalizeDays(settings.invoice_days));
  const [newAmount, setNewAmount] = useState("5");
  const [newWhen, setNewWhen] = useState<"before" | "on" | "after">("after");
  const [problem, setProblem] = useState<string | null>(null);

  function addDay() {
    const n = Math.trunc(Number(newAmount));
    if (newWhen !== "on" && (!Number.isFinite(n) || n < 1)) return setProblem("Escribe cuántos días (1 o más).");
    const value = newWhen === "on" ? 0 : newWhen === "before" ? -n : n;
    if (value < -60 || value > 120) return setProblem("Debe estar entre 60 días antes y 120 días después del vencimiento.");
    if (days.includes(value)) return setProblem(`Ya hay un recordatorio «${stepLabel(value)}».`);
    if (days.length >= 10) return setProblem("Puedes tener hasta 10 recordatorios por factura.");
    setDays(normalizeDays([...days, value]));
  }
  function removeDay(d: number) {
    if (days.length <= 1) return setProblem("Deja al menos uno. Si no quieres recordatorios de facturas, apágalos arriba.");
    setDays(days.filter((x) => x !== d));
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
    >
      <Card className="flex flex-col gap-5">
        <input type="hidden" name="invoice_days" value={days.join(",")} />
        <Switch
          name="invoice_enabled"
          checked={on}
          onChange={setOn}
          label="Recordar al cliente sus facturas por cobrar"
          hint="Facturas emitidas con saldo y con fecha de vencimiento (sueltas, de cotización o de proyecto). Por correo (si el interruptor general está encendido) y en la lista de WhatsApp de Facturas."
        />
        <div className={on ? "" : "pointer-events-none opacity-50"}>
          <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-brand-text">
            Cuándo, respecto al vencimiento
            <InfoHint text="Cada recordatorio sale una sola vez. Si el sistema no pudo revisar algún día, lo recupera hasta 2 días tarde. Pagadas, canceladas y borradores no reciben recordatorios." />
          </p>
          <ul className="mb-3 flex flex-wrap gap-2" aria-label="Recordatorios de factura">
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
                  <button type="button" onClick={() => removeDay(d)} aria-label={`Quitar ${stepLabel(d)}`} className="rounded-full p-0.5 hover:bg-black/5">
                    <X size={13} />
                  </button>
                </Tooltip>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-end gap-2">
            {newWhen !== "on" && (
              <div className="w-24">
                <Input label="Días" type="number" min={1} max={120} value={newAmount} onChange={(e) => setNewAmount(e.target.value)} />
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
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-brand-border pt-4">
          <div className="flex flex-wrap gap-2">
            <Button type="submit" loading={pending}>
              Guardar
            </Button>
            <DiscardButton onClick={onDiscard} />
          </div>
          <MessagesLink tipo="facturacion" label="Editar el texto que recibe el cliente →" />
        </div>
      </Card>
      <ResultDialog open={Boolean(problem)} tone="warning" title="Revisa el recordatorio" onClose={() => setProblem(null)}>
        {problem}
      </ResultDialog>
      <ResultDialog open={err.open} tone="danger" title="No se guardó" onClose={err.close}>
        {state.error}
      </ResultDialog>
    </form>
  );
}

// ───────────────────────────── Encuesta de satisfacción

type SurveyReminderSettings = {
  send_by_default: boolean;
  reminder_enabled: boolean;
  reminder_after_days: number;
  max_reminders: number;
};

export function SurveyReminderForm({ settings, generalOn }: { settings: SurveyReminderSettings; generalOn: boolean }) {
  const [k, setK] = useState(0);
  return <SurveyReminderFormInner key={k} settings={settings} generalOn={generalOn} onDiscard={() => setK(k + 1)} />;
}

function SurveyReminderFormInner({
  settings,
  generalOn,
  onDiscard,
}: {
  settings: SurveyReminderSettings;
  generalOn: boolean;
  onDiscard: () => void;
}) {
  const [state, formAction, pending] = useActionState<ReminderSettingsState, FormData>(saveSurveyReminderAction, {
    error: null,
  });
  useSuccessToast({ success: state.success, successId: state.successId });
  const err = useErrorDialog(state);
  const [offer, setOffer] = useState(settings.send_by_default);
  const [on, setOn] = useState(settings.reminder_enabled);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
    >
      <Card className="flex flex-col gap-5">
        <Switch
          name="send_by_default"
          checked={offer}
          onChange={setOffer}
          label="Ofrecer la encuesta al finalizar un proyecto"
          hint="Al pasar un proyecto a Completado, la pregunta «¿Deseas enviar la encuesta de satisfacción al cliente?» sale marcada; se puede desmarcar en cada cierre."
        />
        <Switch
          name="reminder_enabled"
          checked={on}
          onChange={setOn}
          label="Recordar la encuesta si el cliente no responde"
          hint={
            !on
              ? "Apagado: no se le recuerda la encuesta al cliente."
              : generalOn
                ? "Encendido: sale en la revisión diaria (o con «Enviar ahora»)."
                : "Ojo: el interruptor general está apagado, así que no saldrá hasta encenderlo."
          }
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Recordar cada (días)"
            name="reminder_after_days"
            type="number"
            min={1}
            max={60}
            defaultValue={settings.reminder_after_days}
            disabled={!on}
            hint="Días sin respuesta desde el último envío o recordatorio."
          />
          <Input
            label="Máximo de recordatorios"
            name="max_reminders"
            type="number"
            min={0}
            max={5}
            defaultValue={settings.max_reminders}
            disabled={!on}
            hint="Después de esto no se le insiste más."
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-brand-border pt-4">
          <div className="flex flex-wrap gap-2">
            <Button type="submit" loading={pending}>
              Guardar
            </Button>
            <DiscardButton onClick={onDiscard} />
          </div>
          <MessagesLink tipo="encuesta" label="Editar el texto que recibe el cliente →" />
        </div>
      </Card>
      <ResultDialog open={err.open} tone="danger" title="No se guardó" onClose={err.close}>
        {state.error}
      </ResultDialog>
    </form>
  );
}
