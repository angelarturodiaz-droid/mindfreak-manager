"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Check, Copy, MessageCircle } from "lucide-react";
import { RecipientFields, defaultRecipient, prepareWhatsappWindow, type RecipientValues } from "./recipient-fields";
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
  hint,
}: {
  action: () => Promise<SurveyActionState>;
  hint?: string;
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
        hint={hint}
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
 * Enviar la encuesta (nueva) o reenviar el correo, con el destinatario
 * editable. En una encuesta nueva se elige el canal: correo, WhatsApp o
 * ambos. Viene prellenado con el contacto del proyecto o del cliente.
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
  defaultPhone = "",
  chooseChannel = false,
  warning,
}: {
  action: (input: { name: string; email: string; phone?: string; byEmail?: boolean; byWhatsapp?: boolean }) => Promise<SurveyActionState>;
  label: string;
  title: string;
  submitLabel: string;
  icon?: ReactNode;
  variant?: "primary" | "secondary" | "outline";
  defaultName: string;
  defaultEmail: string;
  defaultPhone?: string;
  /** Encuesta nueva: permite elegir correo y/o WhatsApp. Si no, solo correo. */
  chooseChannel?: boolean;
  /** Aviso amarillo (ej. ya hay una encuesta respondida). */
  warning?: string;
}) {
  const initial = (): RecipientValues =>
    chooseChannel
      ? defaultRecipient({ name: defaultName, email: defaultEmail, phone: defaultPhone })
      : { name: defaultName, email: defaultEmail, phone: defaultPhone, byEmail: true, byWhatsapp: false };
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<RecipientValues>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function send() {
    setError(null);
    if (!value.byEmail && !value.byWhatsapp) {
      setError("Elige cómo enviar la encuesta: correo, WhatsApp o ambos.");
      return;
    }
    const wa = prepareWhatsappWindow(value.byWhatsapp);
    startTransition(async () => {
      try {
        const res = await action(
          chooseChannel
            ? { name: value.name, email: value.email, phone: value.phone, byEmail: value.byEmail, byWhatsapp: value.byWhatsapp }
            : { name: value.name, email: value.email },
        );
        wa.go(res.error ? null : res.whatsappUrl);
        if (res.error) {
          setError(res.error);
          return;
        }
        setOpen(false);
        if (res.warning) toast.warning(res.success ?? "", { duration: 9000 });
        else if (res.success) toast.success(res.success);
      } catch (err) {
        wa.go(null);
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
          setValue(initial());
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
          <RecipientFields value={value} onChange={setValue} showChannels={chooseChannel} />
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

/** Compartir por WhatsApp una encuesta ya creada (mismo enlace). */
export function SurveyWhatsappButton({
  action,
  defaultPhone,
  label = "WhatsApp",
}: {
  action: (input: { phone: string }) => Promise<SurveyActionState>;
  defaultPhone: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState(defaultPhone);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function share() {
    setError(null);
    const wa = prepareWhatsappWindow(true);
    startTransition(async () => {
      try {
        const res = await action({ phone });
        wa.go(res.error ? null : res.whatsappUrl);
        if (res.error) {
          setError(res.error);
          return;
        }
        setOpen(false);
        toast.success(res.success ?? "Se abrió WhatsApp.");
      } catch (err) {
        wa.go(null);
        setError(err instanceof Error ? err.message : "Ocurrió un error inesperado.");
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        icon={<MessageCircle size={14} />}
        onClick={() => {
          setPhone(defaultPhone);
          setError(null);
          setOpen(true);
        }}
      >
        {label}
      </Button>
      <Modal open={open} onClose={() => !pending && setOpen(false)} title="Enviar por WhatsApp">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            share();
          }}
          className="flex flex-col gap-4"
        >
          <Input
            label="WhatsApp"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="809-555-0000"
            icon={<MessageCircle size={14} />}
            hint={phone.trim() ? "Se abrirá WhatsApp con el mensaje y el enlace; solo tocas Enviar." : "Sin número: WhatsApp te deja elegir el chat."}
          />
          {error && <p className="text-sm text-brand-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" loading={pending} icon={<MessageCircle size={14} />}>
              Abrir WhatsApp
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
