"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createSupplierAction, type ActionState } from "@/features/suppliers/actions";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

const initialState: ActionState = { error: null };

export default function NewSupplierPage() {
  const [state, formAction, pending] = useActionState(
    createSupplierAction,
    initialState,
  );

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div>
        <h1 className="text-xl font-semibold text-brand-primary">Nuevo proveedor</h1>
      </div>

      <form action={formAction} className="max-w-md space-y-4">
        <Input label="Nombre" name="name" required />
        <Input label="RNC / Cédula" name="tax_id" />
        <Input label="Categoría" name="category" placeholder="Ej. Catering, Sonido, Mobiliario…" />
        <Input label="Correo" name="email" type="email" />
        <Input label="Teléfono" name="phone" />
        <Input label="Dirección" name="address" />

        {state.error && <p className="text-sm text-brand-danger">{state.error}</p>}

        <div className="flex gap-3">
          <Button type="submit" loading={pending}>
            Guardar proveedor
          </Button>
          <Link href="/suppliers">
            <Button type="button" variant="ghost">
              Cancelar
            </Button>
          </Link>
        </div>
      </form>
    </main>
  );
}
