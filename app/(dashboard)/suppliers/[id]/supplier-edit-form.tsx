"use client";

import { useActionState } from "react";
import { updateSupplierAction, type ActionState } from "@/features/suppliers/actions";
import { Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

const initialState: ActionState = { error: null };

export function SupplierEditForm({
  supplier,
  bankCatalog,
}: {
  supplier: {
    id: string;
    name: string;
    tax_id: string | null;
    category: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    bank_name: string | null;
    bank_account_number: string | null;
    service_type: string | null;
  };
  bankCatalog: { id: string; name: string }[];
}) {
  const updateWithId = updateSupplierAction.bind(null, supplier.id);
  const [state, formAction, pending] = useActionState(updateWithId, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <Input label="Nombre" name="name" defaultValue={supplier.name} required />
      <Input label="RNC / Cédula" name="tax_id" defaultValue={supplier.tax_id ?? ""} />
      <Input label="Categoría" name="category" defaultValue={supplier.category ?? ""} />
      <Input
        label="Tipo de servicio"
        name="service_type"
        defaultValue={supplier.service_type ?? ""}
        placeholder="Ej. Transporte, Renta de equipos…"
      />
      <Input label="Correo" name="email" type="email" defaultValue={supplier.email ?? ""} />
      <Input label="Teléfono" name="phone" defaultValue={supplier.phone ?? ""} />
      <Input label="Dirección" name="address" defaultValue={supplier.address ?? ""} />

      <Select label="Banco" name="bank_name" defaultValue={supplier.bank_name ?? ""}>
        <option value="">Sin especificar</option>
        {bankCatalog.map((b) => (
          <option key={b.id} value={b.name}>
            {b.name}
          </option>
        ))}
        {supplier.bank_name && !bankCatalog.some((b) => b.name === supplier.bank_name) && (
          <option value={supplier.bank_name}>{supplier.bank_name} (no está en el catálogo)</option>
        )}
      </Select>
      <Input
        label="Cuenta banco"
        name="bank_account_number"
        defaultValue={supplier.bank_account_number ?? ""}
        placeholder="Número de cuenta"
      />

      {state.error && <p className="text-sm text-brand-danger">{state.error}</p>}

      <Button type="submit" loading={pending}>
        Guardar cambios
      </Button>
    </form>
  );
}
