"use client";

import { useActionState } from "react";
import { updateClientAction, type ActionState } from "@/features/clients/actions";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

const initialState: ActionState = { error: null };

export function ClientEditForm({
  client,
}: {
  client: {
    id: string;
    name: string;
    tax_id: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
  };
}) {
  const updateWithId = updateClientAction.bind(null, client.id);
  const [state, formAction, pending] = useActionState(updateWithId, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <Input label="Nombre" name="name" defaultValue={client.name} required />
      <Input label="RNC / Cédula" name="tax_id" defaultValue={client.tax_id ?? ""} />
      <Input label="Correo" name="email" type="email" defaultValue={client.email ?? ""} />
      <Input label="Teléfono" name="phone" defaultValue={client.phone ?? ""} />
      <Input label="Dirección" name="address" defaultValue={client.address ?? ""} />

      {state.error && <p className="text-sm text-brand-danger">{state.error}</p>}

      <Button type="submit" loading={pending}>
        Guardar cambios
      </Button>
    </form>
  );
}
