"use client";

import { useActionState } from "react";
import { updateServiceAction, type ActionState } from "@/features/services/actions";
import { SERVICE_TYPES } from "@/features/services/schema";
import { Input, Select, Textarea } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { Button } from "@/components/ui/button";

const initialState: ActionState = { error: null };

const TYPE_LABELS: Record<string, string> = {
  PRODUCTO: "Producto",
  SERVICIO: "Servicio",
};

export function ServiceEditForm({
  service,
  categories,
}: {
  service: {
    id: string;
    name: string;
    category_id: string | null;
    type: string;
    description: string | null;
    unit: string | null;
    default_price: number;
    default_cost: number;
    default_tax_percent: number;
  };
  categories: { id: string; name: string }[];
}) {
  const updateWithId = updateServiceAction.bind(null, service.id);
  const [state, formAction, pending] = useActionState(updateWithId, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <Input label="Nombre" name="name" defaultValue={service.name} required />

      <Select label="Categoría" name="category_id" defaultValue={service.category_id ?? ""}>
        <option value="">Sin categoría</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>

      <Select label="Tipo" name="type" defaultValue={service.type}>
        {SERVICE_TYPES.map((t) => (
          <option key={t} value={t}>
            {TYPE_LABELS[t]}
          </option>
        ))}
      </Select>

      <Textarea label="Descripción" name="description" defaultValue={service.description ?? ""} rows={3} />
      <Input label="Unidad" name="unit" defaultValue={service.unit ?? ""} />

      <div className="grid grid-cols-2 gap-3">
        <MoneyInput label="Costo" name="default_cost" min={0} defaultValue={service.default_cost} />
        <MoneyInput
          label="Precio de venta"
          name="default_price"
          min={0}
          defaultValue={service.default_price}
        />
      </div>

      <Input
        label="Impuesto por defecto (%)"
        name="default_tax_percent"
        type="number"
        step="0.01"
        min="0"
        defaultValue={service.default_tax_percent}
        className="w-32"
      />

      {state.error && <p className="text-sm text-brand-danger">{state.error}</p>}

      <Button type="submit" loading={pending}>
        Guardar cambios
      </Button>
    </form>
  );
}
