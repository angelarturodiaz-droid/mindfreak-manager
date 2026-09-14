"use client";

import { useActionState } from "react";
import { updateOrganizationAction, type ActionState } from "@/features/settings/actions";
import { Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

const initialState: ActionState = { error: null };

export function OrganizationForm({
  company,
}: {
  company: {
    legal_name: string | null;
    tax_id: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    base_currency: string;
  };
}) {
  const [state, formAction, pending] = useActionState(updateOrganizationAction, initialState);

  return (
    <form action={formAction} className="max-w-md space-y-4">
      <Input label="Nombre legal" name="legal_name" defaultValue={company.legal_name ?? ""} />
      <Input label="RNC" name="tax_id" defaultValue={company.tax_id ?? ""} />
      <Input label="Dirección" name="address" defaultValue={company.address ?? ""} />

      <div className="grid grid-cols-2 gap-3">
        <Input label="Teléfono" name="phone" defaultValue={company.phone ?? ""} />
        <Input label="Correo" name="email" type="email" defaultValue={company.email ?? ""} />
      </div>

      <Select
        label="Moneda base"
        name="base_currency"
        defaultValue={company.base_currency}
        hint="Usada para consolidar reportes, dashboard y rentabilidad. Cambiarla no convierte montos ya registrados."
      >
        <option value="DOP">DOP — Peso dominicano</option>
        <option value="USD">USD — Dólar</option>
      </Select>

      {state.error && <p className="text-sm text-brand-danger">{state.error}</p>}

      <Button type="submit" loading={pending}>
        Guardar cambios
      </Button>
    </form>
  );
}
