"use client";

import { useActionState, useEffect, useRef } from "react";
import { changeOwnPasswordAction, type ActionState } from "@/features/profile/actions";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";

const initialState: ActionState = { error: null };

export function ChangePasswordForm({ onDone }: { onDone?: () => void }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(changeOwnPasswordAction, initialState);

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
      <Input label="Contraseña actual" name="current_password" type="password" required autoComplete="current-password" />
      <Input label="Contraseña nueva" name="new_password" type="password" required minLength={8} autoComplete="new-password" />
      <Input label="Confirmar contraseña nueva" name="confirm_password" type="password" required minLength={8} autoComplete="new-password" />

      {state.error && <p className="text-sm text-brand-danger">{state.error}</p>}

      <Button type="submit" loading={pending}>
        Cambiar contraseña
      </Button>
    </form>
  );
}
