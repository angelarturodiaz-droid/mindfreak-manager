"use client";

import { useActionState, useEffect } from "react";
import { updateOwnProfileAction, type ActionState } from "@/features/profile/actions";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";

const initialState: ActionState = { error: null };

export function EditProfileForm({
  fullName,
  phone,
}: {
  fullName: string | null;
  phone: string | null;
}) {
  const [state, formAction, pending] = useActionState(updateOwnProfileAction, initialState);

  useEffect(() => {
    if (state.success) toast.success("Perfil actualizado");
  }, [state.success]);

  return (
    <form action={formAction} className="space-y-4">
      <Input label="Nombre completo" name="full_name" defaultValue={fullName ?? ""} required />
      <Input label="Teléfono" name="phone" defaultValue={phone ?? ""} />

      {state.error && <p className="text-sm text-brand-danger">{state.error}</p>}

      <Button type="submit" loading={pending}>
        Guardar cambios
      </Button>
    </form>
  );
}
