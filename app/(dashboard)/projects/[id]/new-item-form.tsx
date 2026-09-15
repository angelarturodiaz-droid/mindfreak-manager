"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { addProjectItemAction, type ActionState } from "@/features/projects/actions";
import { Input, Select } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { Button } from "@/components/ui/button";

const initialState: ActionState = { error: null };

type Service = {
  id: string;
  name: string;
  unit: string | null;
  default_price: number;
  default_cost: number;
};

export function NewProjectItemForm({
  projectId,
  services,
}: {
  projectId: string;
  services: Service[];
}) {
  const addWithId = addProjectItemAction.bind(null, projectId);
  const [state, formAction, pending] = useActionState(addWithId, initialState);
  const [selectedService, setSelectedService] = useState<Service | null>(null);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <Select
        label="Servicio"
        name="service_id"
        defaultValue=""
        onChange={(e) => {
          const svc = services.find((s) => s.id === e.target.value) ?? null;
          setSelectedService(svc);
        }}
        className="w-44"
      >
        <option value="">Servicio personalizado</option>
        {services.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </Select>
      <Input
        label="Descripción"
        name="description"
        required
        defaultValue={selectedService?.name ?? ""}
        key={selectedService?.id ?? "custom"}
        className="w-48"
      />
      <Input label="Cant." name="quantity" type="number" step="0.01" min="0.01" defaultValue="1" className="w-20" />
      <MoneyInput
        label="Precio"
        name="unit_price"
        defaultValue={selectedService?.default_price ?? 0}
        key={`price-${selectedService?.id ?? "custom"}`}
        className="w-28"
      />
      <MoneyInput
        label="Costo unit. est."
        name="estimated_cost"
        defaultValue={selectedService?.default_cost ?? 0}
        key={`cost-${selectedService?.id ?? "custom"}`}
        className="w-28"
      />
      <Button type="submit" loading={pending} icon={<Plus size={14} />}>
        Agregar línea
      </Button>
      {state.error && <p className="w-full text-sm text-brand-danger">{state.error}</p>}
    </form>
  );
}
