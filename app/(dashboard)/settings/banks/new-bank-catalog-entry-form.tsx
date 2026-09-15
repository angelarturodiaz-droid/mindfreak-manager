"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { createBankCatalogEntryAction, type ActionState } from "@/features/bank-catalog/actions";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

const initialState: ActionState = { error: null };

export function NewBankCatalogEntryForm() {
  const [state, formAction, pending] = useActionState(createBankCatalogEntryAction, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <Input name="name" placeholder="Ej. Banco Ademi" required label="Nombre del banco" />
      <Button type="submit" loading={pending} icon={<Plus size={14} />}>
        Agregar
      </Button>
      {state.error && <p className="w-full text-sm text-brand-danger">{state.error}</p>}
    </form>
  );
}
