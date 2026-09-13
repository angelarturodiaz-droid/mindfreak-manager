"use client";

import { useActionState } from "react";
import { createExpenseCategoryAction, type ActionState } from "@/features/expense-categories/actions";

const initialState: ActionState = { error: null };

export function NewExpenseCategoryForm() {
  const [state, formAction, pending] = useActionState(createExpenseCategoryAction, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <div>
        <label className="block text-xs text-brand-muted">Nombre</label>
        <input
          name="name"
          required
          placeholder="Ej. Catering"
          className="border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        />
      </div>
      <div>
        <label className="block text-xs text-brand-muted">Descripción</label>
        <input
          name="description"
          placeholder="Opcional"
          className="border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Agregando…" : "Agregar"}
      </button>
      {state.error && <p className="w-full text-sm text-brand-danger">{state.error}</p>}
    </form>
  );
}
