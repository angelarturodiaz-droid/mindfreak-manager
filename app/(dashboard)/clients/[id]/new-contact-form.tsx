"use client";

import { useActionState } from "react";
import { UserPlus } from "lucide-react";
import { createContactAction, type ActionState } from "@/features/clients/actions";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

const initialState: ActionState = { error: null };

export function NewContactForm({ clientId }: { clientId: string }) {
  const createWithId = createContactAction.bind(null, clientId);
  const [state, formAction, pending] = useActionState(createWithId, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <Input name="full_name" placeholder="Nombre completo" required className="w-44" />
      <Input name="position" placeholder="Cargo" className="w-32" />
      <Input name="email" type="email" placeholder="Correo" className="w-44" />
      <Input name="phone" placeholder="Teléfono" className="w-36" />
      <label className="flex items-center gap-1 pb-2 text-sm text-brand-muted">
        <input type="checkbox" name="is_primary" />
        Principal
      </label>
      <Button type="submit" variant="outline" loading={pending} icon={<UserPlus size={14} />}>
        Agregar contacto
      </Button>
      {state.error && <p className="w-full text-sm text-brand-danger">{state.error}</p>}
    </form>
  );
}
