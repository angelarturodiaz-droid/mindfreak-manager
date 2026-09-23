"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { createServiceAction, type ActionState } from "@/features/services/actions";
import { SERVICE_TYPES } from "@/features/services/schema";
import { Input, Select } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { Button } from "@/components/ui/button";

const initialState: ActionState = { error: null };

const TYPE_LABELS: Record<string, string> = {
  PRODUCTO: "Producto",
  SERVICIO: "Servicio",
};

type TaxRate = { id: string; name: string; rate: number; treatment: string };

export function NewServiceForm({
  categories,
  taxRates,
}: {
  categories: { id: string; name: string }[];
  taxRates: TaxRate[];
}) {
  const [state, formAction, pending] = useActionState(
    createServiceAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <Input label="Nombre" name="name" placeholder="Nombre" required />
      <Select label="Categoría" name="category_id" defaultValue="">
        <option value="">Sin categoría</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>
      <Select label="Tipo" name="type" defaultValue="SERVICIO">
        {SERVICE_TYPES.map((t) => (
          <option key={t} value={t}>
            {TYPE_LABELS[t]}
          </option>
        ))}
      </Select>
      <Input label="Descripción" name="description" placeholder="Opcional" />
      <Input label="Unidad" name="unit" placeholder="Ej. hora, unidad" className="w-28" />
      <MoneyInput label="Costo" name="default_cost" min={0} defaultValue={0} className="w-24" />
      <MoneyInput
        label="Precio de venta"
        name="default_price"
        min={0}
        defaultValue={0}
        className="w-24"
      />
      <Select label="Tratamiento fiscal" name="default_tax_rate_id" defaultValue="" className="w-44">
        <option value="">Usar el predeterminado del catálogo</option>
        {taxRates.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name} ({r.rate}%)
          </option>
        ))}
      </Select>
      <Button type="submit" loading={pending} icon={<Plus size={14} />}>
        Agregar
      </Button>
      {state.error && <p className="w-full text-sm text-brand-danger">{state.error}</p>}
    </form>
  );
}
