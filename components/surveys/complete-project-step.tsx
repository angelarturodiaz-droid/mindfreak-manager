"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Mail, MailX, Smile } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { completeProjectAction } from "@/features/surveys/actions";
import { SURVEY_STATUS_LABELS } from "@/features/surveys/schema";

/**
 * Paso "Completado" del avance del proyecto. En vez de cambiar el estado de
 * una vez, abre el cierre del proyecto con la pregunta "¿Deseas enviar la
 * encuesta de satisfacción al cliente?" (activada por defecto según
 * Configuración → Encuesta de satisfacción).
 */
export function CompleteProjectStep({
  projectId,
  className,
  title,
  children,
  canSend,
  sendByDefault,
  recipientName,
  recipientEmail,
  existing,
}: {
  projectId: string;
  className: string;
  title: string;
  children: ReactNode;
  canSend: boolean;
  sendByDefault: boolean;
  recipientName: string | null;
  recipientEmail: string | null;
  /** Encuesta ya enviada o respondida de este proyecto (para avisar duplicados). */
  existing: { status: string; date: string | null } | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [send, setSend] = useState(canSend && sendByDefault && !existing);
  const [pending, startTransition] = useTransition();

  function openDialog() {
    setSend(canSend && sendByDefault && !existing);
    setOpen(true);
  }

  function finish() {
    const fd = new FormData();
    if (send) fd.set("send_survey", "on");
    startTransition(async () => {
      try {
        const res = await completeProjectAction(projectId, { error: null }, fd);
        if (res.error) {
          toast.error(res.error);
          return;
        }
        setOpen(false);
        if (res.warning) {
          // El correo no salió (o no hay correo): el enlace está en la pestaña.
          toast.warning(res.success ?? "Proyecto finalizado.", { duration: 9000 });
        } else {
          toast.success(res.success ?? "Proyecto finalizado.");
        }
        if (send) router.push(`/projects/${projectId}?tab=satisfaccion`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ocurrió un error inesperado.");
      }
    });
  }

  const existingDate = existing?.date
    ? new Intl.DateTimeFormat("es-DO", { day: "numeric", month: "short", year: "numeric" }).format(new Date(existing.date))
    : null;

  return (
    <>
      <button type="button" title={title} onClick={openDialog} className={className}>
        {children}
      </button>

      <Modal open={open} onClose={() => !pending && setOpen(false)} title="Finalizar proyecto">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-brand-muted">El proyecto pasará a estado Completado.</p>

          {canSend ? (
            <label
              className={`flex cursor-pointer items-start gap-3 rounded-[var(--radius-md)] border p-3 transition-colors ${
                send ? "border-brand-accent/50 bg-brand-accent-light" : "border-brand-border"
              }`}
            >
              <input
                type="checkbox"
                className="peer sr-only"
                checked={send}
                onChange={(e) => setSend(e.target.checked)}
              />
              <span
                aria-hidden
                className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-brand-accent ${
                  send ? "bg-brand-accent" : "bg-brand-disabled"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${send ? "left-[18px]" : "left-0.5"}`}
                />
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-text">
                  <Smile size={15} className="text-brand-accent" aria-hidden />
                  ¿Deseas enviar la encuesta de satisfacción al cliente?
                </span>
                {recipientEmail ? (
                  <span className="inline-flex items-center gap-1.5 text-xs text-brand-muted">
                    <Mail size={12} aria-hidden />
                    Se enviará a {recipientName ? `${recipientName} · ` : ""}
                    {recipientEmail}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs text-brand-warning">
                    <MailX size={12} aria-hidden />
                    El cliente no tiene correo: se creará el enlace para que lo copies y lo envíes por otra vía.
                  </span>
                )}
              </span>
            </label>
          ) : (
            <p className="rounded-[var(--radius-md)] bg-brand-background px-3 py-2 text-xs text-brand-muted">
              No tienes permiso para enviar encuestas de satisfacción; un administrador puede enviarla después desde la
              pestaña Satisfacción.
            </p>
          )}

          {existing && canSend && (
            <div className="flex gap-2 rounded-[var(--radius-md)] bg-brand-warning-bg px-3 py-2 text-xs text-brand-text">
              <AlertTriangle size={15} className="mt-0.5 shrink-0 text-brand-warning" aria-hidden />
              <span>
                Este proyecto ya tiene una encuesta <strong>{SURVEY_STATUS_LABELS[existing.status]?.toLowerCase()}</strong>
                {existingDate ? ` (${existingDate})` : ""}. Si la activas, el cliente recibirá otra encuesta.
              </span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button type="button" onClick={finish} loading={pending}>
              {send ? "Finalizar y enviar encuesta" : "Finalizar proyecto"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
