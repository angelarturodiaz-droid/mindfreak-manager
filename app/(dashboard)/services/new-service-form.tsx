"use client";

import { useActionState } from "react";
import { createServiceAction, type ActionState } from "@/features/services/actions";

const initialState: ActionState = { error: null };

export function NewServiceForm({
  categories,
}: {
  categories: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(
    createServiceAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <input
        name="name"
        placeholder="Nombre del servicio"
        required
        className="border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
      />
      <select
        name="category_id"
        defaultValue=""
        className="border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
      >
        <option value="">Sin categoría</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <input
        name="unit"
        placeholder="Unidad (ej. hora, evento)"
        className="border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
      />
      <input
        name="default_price"
        type="number"
        step="0.01"
        min="0"
        placeholder="Precio"
        defaultValue="0"
        className="w-28 border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
      />
      <input
        name="default_cost"
        type="number"
        step="0.01"
        min="0"
        placeholder="Costo"
        defaultValue="0"
        className="w-28 border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
      />
      <button
        type="submit"
        disabled={pending}
        className="bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Guardando…" : "Agregar servicio"}
      </button>
      {state.error && <p className="w-full text-sm text-brand-danger">{state.error}</p>}
    </form>
  );
}
