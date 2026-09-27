"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createSupplierAction, type ActionState } from "@/features/suppliers/actions";
import { Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { SupplierCategoryFields } from "@/components/suppliers/supplier-category-fields";

const initialState: ActionState = { error: null };

export function NewSupplierForm({
  bankCatalog,
  categories,
  serviceTypes,
}: {
  bankCatalog: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  serviceTypes: { id: string; name: string; category_id: string }[];
}) {
  const [state, formAction, pending] = useActionState(
    createSupplierAction,
    initialState,
  );

  return (
    <form action={formAction} className="max-w-md space-y-4">
      <Input label="Nombre" name="name" required />
      <Input label="RNC / Cédula" name="tax_id" />
      <SupplierCategoryFields categories={categories} serviceTypes={serviceTypes} />
      <Input label="Correo" name="email" type="email" />
      <Input label="Teléfono" name="phone" />
      <Input label="Dirección" name="address" />

      <Select label="Banco" name="bank_name" defaultValue="">
        <option value="">Sin especificar</option>
        {bankCatalog.map((b) => (
          <option key={b.id} value={b.name}>
            {b.name}
          </option>
        ))}
      </Select>
      <Input label="Cuenta banco" name="bank_account_number" placeholder="Número de cuenta" />

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
  );
}
