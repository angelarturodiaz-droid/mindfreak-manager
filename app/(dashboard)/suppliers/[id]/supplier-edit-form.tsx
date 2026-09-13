"use client";

import { useActionState } from "react";
import { updateSupplierAction, type ActionState } from "@/features/suppliers/actions";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

const initialState: ActionState = { error: null };

export function SupplierEditForm({
  supplier,
}: {
  supplier: {
    id: string;
    name: string;
    tax_id: string | null;
    category: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
  };
}) {
  const updateWithId = updateSupplierAction.bind(null, supplier.id);
  const [state, formAction, pending] = useActionState(updateWithId, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <Input label="Nombre" name="name" defaultValue={supplier.name} required />
      <Input label="RNC / Cédula" name="tax_id" defaultValue={supplier.tax_id ?? ""} />
      <Input label="Categoría" name="category" defaultValue={supplier.category ?? ""} />
      <Input label="Correo" name="email" type="email" defaultValue={supplier.email ?? ""} />
      <Input label="Teléfono" name="phone" defaultValue={supplier.phone ?? ""} />
      <Input label="Dirección" name="address" defaultValue={supplier.address ?? ""} />

      {state.error && <p className="text-sm text-brand-danger">{state.error}</p>}

      <Button type="submit" loading={pending}>
        Guardar cambios
      </Button>
    </form>
  );
}
