"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Check, Copy, Mail } from "lucide-react";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toaster";
import type { SurveyActionState } from "@/features/surveys/actions";

/**
 * Botón para las acciones de una encuesta (enviar, reenviar, cancelar,
 * reabrir). Opcionalmente pide confirmación; el resultado sale como aviso.
 */
export function SurveyActionButton({
  action,
  label,
  icon,
  variant = "outline",
  confirm,
}: {
  action: () => Promise<SurveyActionState>;
  label: string;
  icon?: ReactNode;
  variant?: "primary" | "secondary" | "outline" | "danger";
  confirm?: { title: string; message: string; label: string; danger?: boolean };
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      try {
        const res = await action();
        setOpen(false);
        if (res.error) toast.error(res.error);
        else if (res.warning) toast.warning(res.success ?? "", { duration: 9000 });
        else if (res.success) toast.success(res.success);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ocurrió un error inesperado.");
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant={variant}
        icon={icon}
        loading={pending && !open}
        onClick={() => (confirm ? setOpen(true) : run())}
      >
        {label}
      </Button>
      {confirm && (
        <Modal open={open} onClose={() => !pending && setOpen(false)} title={confirm.title}>
          <p className="text-sm text-brand-muted">{confirm.message}</p>
          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Volver
            </Button>
            <Button type="button" variant={confirm.danger ? "danger" : "primary"} loading={pending} onClick={run}>
              {confirm.label}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}

export function CopySurveyLinkButton({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      icon={copied ? <Check size={14} /> : <Copy size={14} />}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(link);
          setCopied(true);
          toast.success("Enlace copiado.");
          setTimeout(() => setCopied(false), 2000);
        } catch {
          toast.error("No se pudo copiar. Selecciona el enlace y cópialo a mano.");
        }
      }}
    >
      {copied ? "Copiado" : "Copiar enlace"}
    </Button>
  );
}

/**
 * Enviar / reenviar la encuesta con el destinatario editable: viene
 * prellenado (contacto del proyecto o del cliente) y se puede cambiar.
 */
export function SurveySendButton({
  action,
  label,
  title,
  submitLabel,
  icon,
  variant = "outline",
  defaultName,
  defaultEmail,
  warning,
}: {
  action: (input: { name: string; email: string }) => Promise<SurveyActionState>;
  label: string;
  title: string;
  submitLabel: string;
  icon?: ReactNode;
  variant?: "primary" | "secondary" | "outline";
  defaultName: string;
  defaultEmail: string;
  /** Aviso amarillo (ej. ya hay una encuesta respondida). */
  warning?: string;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName);
  const [email, setEmail] = useState(defaultEmail);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function send() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await action({ name, email });
        if (res.error) {
          setError(res.error);
          return;
        }
        setOpen(false);
        if (res.warning) toast.warning(res.success ?? "", { duration: 9000 });
        else if (res.success) toast.success(res.success);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ocurrió un error inesperado.");
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant={variant}
        icon={icon}
        onClick={() => {
          setName(defaultName);
          setEmail(defaultEmail);
          setError(null);
          setOpen(true);
        }}
      >
        {label}
      </Button>
      <Modal open={open} onClose={() => !pending && setOpen(false)} title={title}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="flex flex-col gap-4"
        >
          {warning && (
            <p className="rounded-[var(--radius-md)] bg-brand-warning-bg px-3 py-2 text-xs text-brand-text">{warning}</p>
          )}
          <Input label="Nombre del destinatario" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. María Fernández" />
          <Input
            label="Correo"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="cliente@empresa.com"
            icon={<Mail size={14} />}
            hint={email.trim() ? "Puedes cambiarlo si la encuesta debe ir a otra persona." : "Sin correo: se creará el enlace para copiarlo."}
          />
          {error && <p className="text-sm text-brand-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" loading={pending}>
              {submitLabel}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
