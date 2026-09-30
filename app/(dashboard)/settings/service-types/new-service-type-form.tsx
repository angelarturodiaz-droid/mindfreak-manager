"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { createServiceTypeAction, type ActionState } from "@/features/supplier-service-types/actions";
import { Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useSuccessToast } from "@/components/ui/use-success-toast";

const initialState: ActionState = { error: null };

export function NewServiceTypeForm({ categories }: { categories: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState(createServiceTypeAction, initialState);
  useSuccessToast(state);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <Select label="Categoría" name="category_id" defaultValue="" required className="w-56">
        <option value="" disabled>
          Selecciona…
        </option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>
      <Input name="name" label="Tipo de servicio" placeholder="Ej. Alquiler de sonido" required />
      <Button type="submit" loading={pending} icon={<Plus size={14} />}>
        Agregar
      </Button>
      {state.error && <p className="w-full text-sm text-brand-danger">{state.error}</p>}
    </form>
  );
}
