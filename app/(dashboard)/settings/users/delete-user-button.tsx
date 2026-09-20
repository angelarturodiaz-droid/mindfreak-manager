"use client";

import { useState, useTransition } from "react";
import { Trash2, KeyRound } from "lucide-react";
import { deleteUserAction } from "@/features/users/actions";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";

export function DeleteUserButton({ userId, userName }: { userId: string; userName: string }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [isPending, startTransition] = useTransition();

  function reset() {
    setOpen(false);
    setCode("");
  }

  function handleDelete() {
    if (!window.confirm(`¿Eliminar a ${userName} por completo? No se puede deshacer.`)) return;
    startTransition(async () => {
      try {
        await deleteUserAction(userId, code);
        toast.success(`${userName} fue eliminado`);
        reset();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "No se pudo eliminar.");
        setCode("");
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-sm text-brand-danger hover:underline"
      >
        <Trash2 size={13} /> Eliminar
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1 text-[11px] text-brand-muted">
        <KeyRound size={11} />
        <span>Confirma con tu código de autenticador</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          autoFocus
          inputMode="numeric"
          placeholder="123456"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          onKeyDown={(e) => e.key === "Enter" && code.length === 6 && handleDelete()}
          disabled={isPending}
          className="w-24 rounded-[var(--radius-sm)] border border-brand-danger bg-brand-surface px-1.5 py-1 text-sm tracking-widest outline-none"
        />
        <Button size="sm" variant="danger" loading={isPending} disabled={code.length !== 6} onClick={handleDelete}>
          Eliminar
        </Button>
        <button type="button" onClick={reset} className="text-sm text-brand-muted hover:text-brand-text">
          Cancelar
        </button>
      </div>
    </div>
  );
}
