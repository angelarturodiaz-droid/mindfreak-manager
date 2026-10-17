"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { PasswordChecklist } from "@/components/ui/password-checklist";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/password-policy";
import { changeOwnPasswordAction, type ActionState } from "@/features/profile/actions";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";

const initialState: ActionState = { error: null };

export function ChangePasswordForm({ onDone }: { onDone?: () => void }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(changeOwnPasswordAction, initialState);
  const [pw, setPw] = useState("");

  useEffect(() => {
    if (state.success) {
      toast.success("Contraseña actualizada");
      formRef.current?.reset();
      onDone?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <PasswordInput label="Contraseña actual" name="current_password" required autoComplete="current-password" />
      <PasswordInput
        label="Contraseña nueva"
        name="new_password"
        required
        minLength={PASSWORD_MIN_LENGTH}
        autoComplete="new-password"
        onChange={(e) => setPw(e.target.value)}
      />
      <PasswordChecklist password={pw} />
      <PasswordInput label="Confirmar contraseña nueva" name="confirm_password" required minLength={PASSWORD_MIN_LENGTH} autoComplete="new-password" />

      {state.error && <p className="text-sm text-brand-danger">{state.error}</p>}

      <Button type="submit" loading={pending}>
        Cambiar contraseña
      </Button>
    </form>
  );
}
