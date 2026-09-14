"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { createExpenseCategoryAction, type ActionState } from "@/features/expense-categories/actions";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

const initialState: ActionState = { error: null };

export function NewExpenseCategoryForm() {
  const [state, formAction, pending] = useActionState(createExpenseCategoryAction, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <Input name="name" placeholder="Ej. Catering" required label="Nombre" />
      <Input name="description" placeholder="Opcional" label="Descripción" />
      <Button type="submit" loading={pending} icon={<Plus size={14} />}>
        Agregar
      </Button>
      {state.error && <p className="w-full text-sm text-brand-danger">{state.error}</p>}
    </form>
  );
}
