"use client";

import { useState, useTransition } from "react";
import { KeyRound } from "lucide-react";
import { resetUserPasswordAction } from "@/features/users/actions";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { PasswordInput } from "@/components/ui/password-input";
import { ResultDialog } from "@/components/ui/result-dialog";
import { isNavigationSignal } from "@/lib/utils/navigation-signal";
import { PasswordChecklist } from "@/components/ui/password-checklist";
import { generateStrongPassword, passwordProblem } from "@/lib/auth/password-policy";

/** Ícono de llave → ventana para poner una contraseña nueva al usuario. */
export function ResetPasswordButton({ userId, userName }: { userId: string; userName: string }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  function close() {
    setOpen(false);
    setPassword("");
  }

  function handleSave() {
    const problem = passwordProblem(password, { name: userName });
    if (problem) {
      setResult({ tone: "danger", text: problem });
      return;
    }
    startTransition(async () => {
      try {
        await resetUserPasswordAction(userId, password);
        close();
        setResult({ tone: "success", text: `Contraseña de ${userName} actualizada. Pásasela por un medio seguro.` });
      } catch (e) {
        if (isNavigationSignal(e)) return;
        setResult({ tone: "danger", text: e instanceof Error ? e.message : "No se pudo actualizar." });
      }
    });
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        icon={<KeyRound size={15} />}
        aria-label={`Restablecer contraseña de ${userName}`}
        hint="Restablecer contraseña: pon o genera una contraseña nueva para esta persona"
        onClick={() => setOpen(true)}
        className="text-brand-accent"
      />
      {open && (
        <Modal open onClose={() => !isPending && close()} title={`Nueva contraseña para ${userName}`}>
          <div className="flex flex-col gap-4 text-sm">
            <p className="text-brand-muted">Debe ser segura. Lo más fácil: pulsa <strong>Generar</strong> y pásasela por un medio seguro.</p>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <PasswordInput
                  label="Contraseña nueva"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                />
              </div>
              <Button size="sm" variant="outline" type="button" onClick={() => setPassword(generateStrongPassword())}>
                Generar
              </Button>
            </div>
            <PasswordChecklist password={password} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={close} disabled={isPending}>
                Cancelar
              </Button>
              <Button type="button" loading={isPending} onClick={handleSave}>
                Guardar contraseña
              </Button>
            </div>
          </div>
        </Modal>
      )}
      <ResultDialog
        open={!!result}
        tone={result?.tone ?? "success"}
        title={result?.tone === "danger" ? "No se cambió la contraseña" : "Contraseña actualizada"}
        onClose={() => setResult(null)}
      >
        <p className="text-sm text-brand-muted">{result?.text}</p>
      </ResultDialog>
    </>
  );
}
