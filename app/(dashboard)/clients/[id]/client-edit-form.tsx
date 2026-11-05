"use client";

import { useActionState, useTransition, type FormEvent } from "react";
import { useSuccessToast } from "@/components/ui/use-success-toast";
import { updateClientAction, type ActionState } from "@/features/clients/actions";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { ClientEcfFields } from "@/components/clients/client-ecf-fields";

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
    foreign_id?: string | null;
    province_code?: string | null;
    municipality_code?: string | null;
  };
}) {
  const updateWithId = updateClientAction.bind(null, client.id);
  const [state, formAction, pending] = useActionState(updateWithId, initialState);
  const [, startTransition] = useTransition();
  useSuccessToast(state);

  // Envío sin el reinicio automático del formulario de React 19: así la provincia y el municipio
  // (listas controladas) siguen mostrando lo guardado.
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => formAction(fd));
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {/* 4-nov: más compacto (dos columnas) para que la página no quede larga de este lado. */}
      <Input label="Nombre" name="name" defaultValue={client.name} required />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input label="RNC / Cédula" name="tax_id" defaultValue={client.tax_id ?? ""} />
        <Input label="Teléfono" name="phone" defaultValue={client.phone ?? ""} />
      </div>
      <Input label="Correo" name="email" type="email" defaultValue={client.email ?? ""} />
      <Input label="Dirección" name="address" defaultValue={client.address ?? ""} />
      <ClientEcfFields defaults={client} collapsible />

      {state.error && <p className="text-sm text-brand-danger">{state.error}</p>}

      <Button type="submit" loading={pending}>
        Guardar cambios
      </Button>
    </form>
  );
}
