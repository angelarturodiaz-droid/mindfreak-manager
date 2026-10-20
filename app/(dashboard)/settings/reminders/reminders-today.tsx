"use client";

import { useState, useTransition } from "react";
import { Eye, Mail, Search, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InfoHint } from "@/components/ui/info-hint";
import { ResultDialog } from "@/components/ui/result-dialog";
import { Chip } from "@/components/ui/page-kit";
import {
  previewRemindersAction,
  sendRemindersNowAction,
  type ReminderPreviewItem,
  type ReminderRunState,
} from "@/features/reminders/actions";

/**
 * "Hoy": ver qué recordatorios tocan hoy (sin enviar) y, si los envíos están
 * encendidos, enviarlos ya (lo mismo que hace la tarea diaria de las 8:15).
 */
export function RemindersToday({ autoSendEnabled }: { autoSendEnabled: boolean }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ReminderRunState | null>(null);
  const [mode, setMode] = useState<"preview" | "send" | null>(null);
  const [emailPreview, setEmailPreview] = useState<ReminderPreviewItem | null>(null);
  const [confirmSend, setConfirmSend] = useState(false);
  const [dialog, setDialog] = useState<{ tone: "success" | "danger" | "warning"; title: string; text: string } | null>(null);

  function preview() {
    setMode("preview");
    startTransition(async () => {
      const r = await previewRemindersAction();
      if (r.error) setDialog({ tone: "danger", title: "No se pudo revisar", text: r.error });
      else setResult(r);
    });
  }

  function send() {
    setConfirmSend(false);
    setMode("send");
    startTransition(async () => {
      const r = await sendRemindersNowAction();
      if (r.error) {
        setDialog({ tone: "danger", title: "No se pudo enviar", text: r.error });
        return;
      }
      // La lista de "hoy" se vuelve a revisar sola: lo que ya salió deja de aparecer.
      const fresh = await previewRemindersAction();
      setResult(fresh.error ? { ...r, items: [] } : fresh);
      if ((r.sent ?? 0) === 0 && (r.failed ?? 0) === 0) {
        setDialog({ tone: "warning", title: "No había nada que enviar", text: "Hoy no toca ningún recordatorio (o ya se enviaron)." });
      } else if ((r.failed ?? 0) > 0) {
        setDialog({
          tone: "warning",
          title: `Se enviaron ${r.sent}, fallaron ${r.failed}`,
          text: `${(r.errors ?? []).join(" · ")}. Los que fallaron se vuelven a intentar en la próxima revisión.`,
        });
      } else {
        setDialog({
          tone: "success",
          title: `Se enviaron ${r.sent} recordatorio${r.sent === 1 ? "" : "s"}`,
          text: "Quedan en el historial de abajo, en la Gestión de cobro de cada factura y en la campana del responsable.",
        });
      }
    });
  }

  const items = result?.items ?? [];
  const toSend = items.filter((i) => !i.blocked);

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-1.5 font-semibold text-brand-text">
            Recordatorios de hoy — todos los tipos
            <InfoHint text="Vale para los dos: los recordatorios de facturas (bloque 2) y los de la encuesta (bloque 3). «Ver qué sale hoy» muestra, sin enviar nada, a quién le tocaría hoy un recordatorio y por qué. «Enviar ahora» hace lo mismo que la tarea diaria de las 8:15 a. m. (útil para probar). Un mismo recordatorio nunca sale dos veces." />
          </h3>
          <p className="text-xs text-brand-muted">Revisa antes de que salgan, o envía ya sin esperar a mañana.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            icon={<Search size={14} />}
            loading={pending && mode === "preview"}
            onClick={preview}
          >
            Ver qué sale hoy
          </Button>
          <Button
            type="button"
            icon={<Send size={14} />}
            loading={pending && mode === "send"}
            disabled={!autoSendEnabled}
            title={autoSendEnabled ? undefined : "Enciende «Envíos automáticos» y guarda para poder enviar."}
            onClick={() => setConfirmSend(true)}
          >
            Enviar ahora
          </Button>
        </div>
      </div>

      {!autoSendEnabled && (
        <p className="rounded-[var(--radius-md)] bg-brand-surface-hover px-3 py-2 text-xs text-brand-muted">
          Los envíos automáticos están <strong>apagados</strong>: puedes ver qué saldría, pero no se envía nada a los
          clientes hasta que los enciendas arriba y guardes.
        </p>
      )}

      {result && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-brand-text">
            {items.length === 0
              ? "Hoy no toca ningún recordatorio."
              : `Hoy tocan ${items.length} recordatorio${items.length === 1 ? "" : "s"}${
                  toSend.length !== items.length ? ` (${toSend.length} se pueden enviar)` : ""
                }.`}
          </p>
          {items.length > 0 && (
            <ul className="divide-y divide-brand-border rounded-[var(--radius-md)] border border-brand-border">
              {items.map((it) => (
                <li key={`${it.kind}-${it.entityId}-${it.step}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-sm">
                  <Mail size={15} className="shrink-0 text-brand-muted" aria-hidden />
                  <Chip tone={it.kind === "SURVEY" ? "success" : "muted"}>{it.kind === "SURVEY" ? "Encuesta" : "Factura"}</Chip>
                  <span className="font-medium text-brand-text">{it.title.replace(/^Encuesta · /, "")}</span>
                  <Chip tone={it.kind === "SURVEY" ? "accent" : it.step > 0 ? "danger" : it.step === 0 ? "warning" : "accent"}>
                    {it.stepText}
                  </Chip>
                  <span className="text-brand-muted">{it.recipient ? `${it.recipient}${it.recipientLabel && it.kind === "INVOICE" ? ` · ${it.recipientLabel}` : ""}` : "sin correo"}</span>
                  {it.blocked && <Chip tone="warning">{it.blocked}</Chip>}
                  <button
                    type="button"
                    onClick={() => setEmailPreview(it)}
                    className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-brand-accent hover:underline"
                  >
                    <Eye size={13} /> Ver correo
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {emailPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Vista del correo">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEmailPreview(null)} aria-hidden="true" />
          <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col gap-3 rounded-[var(--radius-lg)] bg-brand-surface p-5 shadow-[var(--shadow-lg)]">
            <div>
              <p className="text-xs text-brand-muted">Para: {emailPreview.recipient ?? "— (sin correo)"}</p>
              <p className="text-sm font-semibold text-brand-text">{emailPreview.subject}</p>
            </div>
            <iframe
              title="Vista del correo"
              srcDoc={emailPreview.html}
              sandbox=""
              className="h-[60vh] w-full rounded-[var(--radius-md)] border border-brand-border bg-white"
            />
            <div className="flex justify-end">
              <Button type="button" variant="outline" onClick={() => setEmailPreview(null)}>
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      )}

      <ResultDialog
        open={confirmSend}
        tone="warning"
        title="¿Enviar los recordatorios de hoy?"
        onClose={() => setConfirmSend(false)}
        actions={
          <>
            <Button type="button" variant="outline" onClick={() => setConfirmSend(false)}>
              No, volver
            </Button>
            <Button type="button" icon={<Send size={14} />} onClick={send}>
              Sí, enviar ahora
            </Button>
          </>
        }
      >
        Se mandan por correo a los clientes los recordatorios que tocan hoy (los mismos de «Ver qué sale hoy»). Los que
        ya se enviaron no se repiten.
      </ResultDialog>
      <ResultDialog open={Boolean(dialog)} tone={dialog?.tone ?? "success"} title={dialog?.title ?? ""} onClose={() => setDialog(null)}>
        {dialog?.text}
      </ResultDialog>
    </Card>
  );
}
