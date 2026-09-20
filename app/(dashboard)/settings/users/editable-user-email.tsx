"use client";

import { useState, useTransition } from "react";
import { Pencil, Check, X, ShieldCheck, ShieldAlert, KeyRound } from "lucide-react";
import { updateUserEmailAction, resendEmailVerificationAction } from "@/features/users/actions";
import { toast } from "@/components/ui/toaster";

export function EditableUserEmail({
  userId,
  email,
  isConfirmed,
}: {
  userId: string;
  email: string;
  isConfirmed: boolean;
}) {
  const [editing, setEditing] = useState(false);
  // "email": escribiendo la dirección nueva. "code": confirmando con el
  // autenticador del admin antes de aplicar el cambio (ver
  // updateUserEmailAction — cambiar el correo de otra persona equivale a
  // poder tomar el control de su cuenta, así que se pide re-verificar
  // MFA aquí aunque la sesión ya esté iniciada).
  const [step, setStep] = useState<"email" | "code">("email");
  const [value, setValue] = useState(email);
  const [code, setCode] = useState("");
  const [isPending, startTransition] = useTransition();

  function reset() {
    setValue(email);
    setCode("");
    setStep("email");
    setEditing(false);
  }

  function handleContinue() {
    const trimmed = value.trim();
    if (!trimmed || trimmed.toLowerCase() === email.toLowerCase()) {
      toast.error("Escribe un correo distinto al actual.");
      return;
    }
    setStep("code");
  }

  function handleSave() {
    startTransition(async () => {
      try {
        await updateUserEmailAction(userId, value, code);
        toast.success("Correo actualizado");
        reset();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "No se pudo guardar.");
        setCode("");
      }
    });
  }

  function handleResend() {
    startTransition(async () => {
      try {
        await resendEmailVerificationAction(email);
        toast.success("Correo de verificación reenviado");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "No se pudo reenviar.");
      }
    });
  }

  if (editing && step === "email") {
    return (
      <div className="flex items-center gap-1">
        <input
          autoFocus
          type="email"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleContinue()}
          disabled={isPending}
          className="w-48 rounded-[var(--radius-sm)] border border-brand-accent bg-brand-surface px-1.5 py-0.5 text-sm outline-none"
        />
        <button type="button" onClick={handleContinue} disabled={isPending} className="text-brand-success" title="Continuar">
          <Check size={14} />
        </button>
        <button type="button" onClick={reset} className="text-brand-muted">
          <X size={14} />
        </button>
      </div>
    );
  }

  if (editing && step === "code") {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1 text-[11px] text-brand-muted">
          <KeyRound size={11} />
          <span>Confirma con tu código de autenticador</span>
        </div>
        <div className="flex items-center gap-1">
          <input
            autoFocus
            inputMode="numeric"
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            onKeyDown={(e) => e.key === "Enter" && code.length === 6 && handleSave()}
            disabled={isPending}
            className="w-24 rounded-[var(--radius-sm)] border border-brand-accent bg-brand-surface px-1.5 py-0.5 text-sm tracking-widest outline-none"
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending || code.length !== 6}
            className="text-brand-success disabled:opacity-40"
            title="Confirmar cambio"
          >
            <Check size={14} />
          </button>
          <button type="button" onClick={reset} className="text-brand-muted">
            <X size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <button type="button" onClick={() => setEditing(true)} className="group flex items-center gap-1.5 text-left">
        <span className="text-brand-muted">{email}</span>
        <Pencil size={11} className="text-brand-muted opacity-0 group-hover:opacity-100" />
      </button>
      {isConfirmed ? (
        <span title="Correo verificado">
          <ShieldCheck size={13} className="text-brand-success" />
        </span>
      ) : (
        <button
          type="button"
          onClick={handleResend}
          disabled={isPending}
          title="Correo sin verificar — clic para reenviar"
          className="flex items-center gap-1 text-brand-danger hover:underline disabled:opacity-50"
        >
          <ShieldAlert size={13} />
          <span className="text-xs">Reenviar</span>
        </button>
      )}
    </div>
  );
}
