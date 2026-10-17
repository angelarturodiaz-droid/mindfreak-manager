"use client";

import { useState, useTransition } from "react";
import { Trash2, KeyRound } from "lucide-react";
import { deleteUserAction } from "@/features/users/actions";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ResultDialog } from "@/components/ui/result-dialog";
import { isNavigationSignal } from "@/lib/utils/navigation-signal";

/** Ícono de papelera → ventana que pide el código del autenticador para eliminar. */
export function DeleteUserButton({ userId, userName }: { userId: string; userName: string }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  function close() {
    setOpen(false);
    setCode("");
  }

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteUserAction(userId, code);
        close();
        setResult({ tone: "success", text: `${userName} fue eliminado.` });
      } catch (e) {
        if (isNavigationSignal(e)) return;
        setCode("");
        setResult({ tone: "danger", text: e instanceof Error ? e.message : "No se pudo eliminar." });
      }
    });
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        icon={<Trash2 size={15} />}
        aria-label={`Eliminar a ${userName}`}
        hint="Eliminar la cuenta para siempre (solo si nunca registró actividad; pide tu código)"
        onClick={() => setOpen(true)}
        className="text-brand-danger"
      />
      {open && (
        <Modal open onClose={() => !isPending && close()} title={`¿Eliminar a ${userName}?`}>
          <div className="flex flex-col gap-4 text-sm">
            <p className="text-brand-muted">
              Se borra la cuenta por completo y <strong>no se puede deshacer</strong>. Solo funciona si nunca registró
              actividad en el sistema; si ya creó algo, usa <em>Desactivar</em>.
            </p>
            <div className="flex flex-col gap-1">
              <label className="flex items-center gap-1 text-xs font-medium text-brand-text" htmlFor={`del-code-${userId}`}>
                <KeyRound size={12} /> Tu código del autenticador
              </label>
              <input
                id={`del-code-${userId}`}
                autoFocus
                inputMode="numeric"
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                onKeyDown={(e) => e.key === "Enter" && code.length === 6 && handleDelete()}
                disabled={isPending}
                className="w-32 rounded-[var(--radius-md)] border border-brand-border bg-brand-surface px-3 py-2 text-sm tracking-widest outline-none focus:border-brand-danger"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={close} disabled={isPending}>
                Cancelar
              </Button>
              <Button type="button" variant="danger" loading={isPending} disabled={code.length !== 6} onClick={handleDelete}>
                Eliminar definitivamente
              </Button>
            </div>
          </div>
        </Modal>
      )}
      <ResultDialog
        open={!!result}
        tone={result?.tone ?? "success"}
        title={result?.tone === "danger" ? "No se eliminó" : "Usuario eliminado"}
        onClose={() => setResult(null)}
      >
        <p className="text-sm text-brand-muted">{result?.text}</p>
      </ResultDialog>
    </>
  );
}
