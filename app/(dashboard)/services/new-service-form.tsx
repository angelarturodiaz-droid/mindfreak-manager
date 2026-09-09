"use client";

import { useActionState } from "react";
import { createServiceAction, type ActionState } from "@/features/services/actions";
import { SERVICE_TYPES } from "@/features/services/schema";

const initialState: ActionState = { error: null };

const TYPE_LABELS: Record<string, string> = {
  PRODUCTO: "Producto",
  SERVICIO: "Servicio",
};

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
      <div>
        <label className="block text-xs text-brand-muted">Nombre</label>
        <input
          name="name"
          placeholder="Nombre"
          required
          className="border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        />
      </div>
      <div>
        <label className="block text-xs text-brand-muted">Categoría</label>
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
      </div>
      <div>
        <label className="block text-xs text-brand-muted">Tipo</label>
        <select
          name="type"
          defaultValue="SERVICIO"
          className="border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        >
          {SERVICE_TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs text-brand-muted">Descripción</label>
        <input
          name="description"
          placeholder="Opcional"
          className="border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        />
      </div>
      <div>
        <label className="block text-xs text-brand-muted">Unidad</label>
        <input
          name="unit"
          placeholder="Ej. hora, unidad"
          className="w-28 border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        />
      </div>
      <div>
        <label className="block text-xs text-brand-muted">Costo</label>
        <input
          name="default_cost"
          type="number"
          step="0.01"
          min="0"
          defaultValue="0"
          className="w-24 border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        />
      </div>
      <div>
        <label className="block text-xs text-brand-muted">Precio de venta</label>
        <input
          name="default_price"
          type="number"
          step="0.01"
          min="0"
          defaultValue="0"
          className="w-24 border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        />
      </div>
      <div>
        <label className="block text-xs text-brand-muted">Impuesto (%)</label>
        <input
          name="default_tax_percent"
          type="number"
          step="0.01"
          min="0"
          defaultValue="18"
          className="w-20 border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Guardando…" : "Agregar"}
      </button>
      {state.error && <p className="w-full text-sm text-brand-danger">{state.error}</p>}
    </form>
  );
}

