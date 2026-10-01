"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";
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
