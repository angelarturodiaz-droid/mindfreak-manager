"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { createTaxRateAction, type ActionState } from "@/features/tax-rates/actions";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

const initialState: ActionState = { error: null };

export function NewTaxRateForm() {
  const [state, formAction, pending] = useActionState(createTaxRateAction, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <Input label="Nombre" name="name" required placeholder="Ej. ITBIS 18%" />
      <Input label="Tasa (%)" name="rate" type="number" step="0.001" min="0" defaultValue="0" className="w-28" />
      <label className="flex items-center gap-2 pb-2 text-sm text-brand-text">
        <input type="checkbox" name="is_default" />
        Predeterminada
      </label>
      <Button type="submit" loading={pending} icon={<Plus size={14} />}>
        Agregar tasa
      </Button>
      {state.error && <p className="w-full text-sm text-brand-danger">{state.error}</p>}
    </form>
  );
}
