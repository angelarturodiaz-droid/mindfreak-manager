"use client";

import { useActionState } from "react";
import { createServiceCategoryAction, type ActionState } from "@/features/services/actions";

const initialState: ActionState = { error: null };

export function NewCategoryForm() {
  const [state, formAction, pending] = useActionState(
    createServiceCategoryAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex items-end gap-2">
      <input
        name="name"
        placeholder="Nombre de la categoría"
        required
        className="border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
      />
      <button
        type="submit"
        disabled={pending}
        className="border border-brand-muted/30 px-4 py-2 text-sm text-brand-text hover:border-brand-accent disabled:opacity-50"
      >
        {pending ? "Agregando…" : "Agregar categoría"}
      </button>
      {state.error && <p className="text-sm text-brand-danger">{state.error}</p>}
    </form>
  );
}
