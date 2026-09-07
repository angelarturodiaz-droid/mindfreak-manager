"use client";

import { useActionState } from "react";
import { updateServiceAction, type ActionState } from "@/features/services/actions";

const initialState: ActionState = { error: null };

export function ServiceEditForm({
  service,
  categories,
}: {
  service: {
    id: string;
    name: string;
    category_id: string | null;
    unit: string | null;
    default_price: number;
    default_cost: number;
  };
  categories: { id: string; name: string }[];
}) {
  const updateWithId = updateServiceAction.bind(null, service.id);
  const [state, formAction, pending] = useActionState(updateWithId, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-brand-text">Nombre</label>
        <input
          name="name"
          defaultValue={service.name}
          required
          className="mt-1 w-full border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-brand-text">
          Categoría
        </label>
        <select
          name="category_id"
          defaultValue={service.category_id ?? ""}
          className="mt-1 w-full border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        >
          <option value="">Sin categoría</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-brand-text">
          Unidad
        </label>
        <input
          name="unit"
          defaultValue={service.unit ?? ""}
          className="mt-1 w-full border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-brand-text">
          Precio por defecto
        </label>
        <input
          name="default_price"
          type="number"
          step="0.01"
          min="0"
          defaultValue={service.default_price}
          className="mt-1 w-full border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-brand-text">
          Costo por defecto
        </label>
        <input
          name="default_cost"
          type="number"
          step="0.01"
          min="0"
          defaultValue={service.default_cost}
          className="mt-1 w-full border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        />
      </div>

      {state.error && <p className="text-sm text-brand-danger">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Guardando…" : "Guardar cambios"}
      </button>
    </form>
  );
}
