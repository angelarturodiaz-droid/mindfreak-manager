"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createClientAction, type ActionState } from "@/features/clients/actions";
import { Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

const initialState: ActionState = { error: null };

export default function NewClientPage() {
  const [state, formAction, pending] = useActionState(
    createClientAction,
    initialState,
  );

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div>
        <h1 className="text-xl font-semibold text-brand-primary">Nuevo cliente</h1>
        <p className="text-sm text-brand-muted">
          Puedes registrarlo como cliente potencial (lead) si aún no se ha
          concretado ningún negocio.
        </p>
      </div>

      <form action={formAction} className="max-w-md space-y-4">
        <Input label="Nombre" name="name" required />
        <Input label="RNC / Cédula" name="tax_id" />
        <Input label="Correo" name="email" type="email" />
        <Input label="Teléfono" name="phone" />
        <Input label="Dirección" name="address" />
        <Select label="Estado inicial" name="status" defaultValue="LEAD">
          <option value="LEAD">Cliente potencial (lead)</option>
          <option value="ACTIVE">Cliente activo</option>
        </Select>

        {state.error && <p className="text-sm text-brand-danger">{state.error}</p>}

        <div className="flex gap-3">
          <Button type="submit" loading={pending}>
            Guardar cliente
          </Button>
          <Link href="/clients">
            <Button type="button" variant="ghost">
              Cancelar
            </Button>
          </Link>
        </div>
      </form>
    </main>
  );
}
