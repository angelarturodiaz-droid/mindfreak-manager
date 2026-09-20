"use client";

import { useState, useTransition } from "react";
import { KeyRound } from "lucide-react";
import { resetUserPasswordAction } from "@/features/users/actions";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { toast } from "@/components/ui/toaster";

function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
  let pass = "";
  for (let i = 0; i < 12; i++) {
    pass += chars[Math.floor(Math.random() * chars.length)];
  }
  return pass;
}

export function ResetPasswordButton({ userId, userName }: { userId: string; userName: string }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    if (password.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    startTransition(async () => {
      try {
        await resetUserPasswordAction(userId, password);
        toast.success(`Contraseña de ${userName} actualizada`);
        setOpen(false);
        setPassword("");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "No se pudo actualizar.");
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-sm text-brand-accent hover:underline"
      >
        <KeyRound size={13} /> Restablecer contraseña
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <PasswordInput
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Nueva contraseña"
        autoFocus
        className="w-40 py-1"
      />
      <Button size="sm" variant="outline" type="button" onClick={() => setPassword(generatePassword())}>
        Generar
      </Button>
      <Button size="sm" loading={isPending} onClick={handleSave}>
        Guardar
      </Button>
      <button
        type="button"
        onClick={() => {
          setOpen(false);
          setPassword("");
        }}
        className="text-sm text-brand-muted hover:text-brand-text"
      >
        Cancelar
      </button>
    </div>
  );
}
