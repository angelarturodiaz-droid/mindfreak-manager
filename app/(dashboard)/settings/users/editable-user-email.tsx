"use client";

import { useState, useTransition } from "react";
import { Pencil, Check, X, ShieldCheck, ShieldAlert } from "lucide-react";
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
  const [value, setValue] = useState(email);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      try {
        await updateUserEmailAction(userId, value);
        toast.success("Correo actualizado — se envió un correo de verificación a la nueva dirección");
        setEditing(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "No se pudo guardar.");
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

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          autoFocus
          type="email"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={isPending}
          className="w-48 rounded-[var(--radius-sm)] border border-brand-accent bg-brand-surface px-1.5 py-0.5 text-sm outline-none"
        />
        <button type="button" onClick={handleSave} disabled={isPending} className="text-brand-success">
          <Check size={14} />
        </button>
        <button
          type="button"
          onClick={() => {
            setValue(email);
            setEditing(false);
          }}
          className="text-brand-muted"
        >
          <X size={14} />
        </button>
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
