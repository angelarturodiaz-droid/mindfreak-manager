"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { createServiceCategoryAction, type ActionState } from "@/features/services/actions";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

const initialState: ActionState = { error: null };

export function NewCategoryForm() {
  const [state, formAction, pending] = useActionState(
    createServiceCategoryAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex items-end gap-2">
      <Input name="name" placeholder="Nombre de la categoría" required />
      <Button type="submit" variant="outline" loading={pending} icon={<Plus size={14} />}>
        Agregar categoría
      </Button>
      {state.error && <p className="text-sm text-brand-danger">{state.error}</p>}
    </form>
  );
}
