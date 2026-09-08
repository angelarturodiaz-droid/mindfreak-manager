"use client";

import { useActionState } from "react";
import { createTaxRateAction, type ActionState } from "@/features/tax-rates/actions";

const initialState: ActionState = { error: null };

export function NewTaxRateForm() {
  const [state, formAction, pending] = useActionState(createTaxRateAction, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <div>
        <label className="block text-xs text-brand-muted">Nombre</label>
        <input
          name="name"
          required
          placeholder="Ej. ITBIS 18%"
          className="border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        />
      </div>
      <div>
        <label className="block text-xs text-brand-muted">Tasa (%)</label>
        <input
          name="rate"
          type="number"
          step="0.001"
          min="0"
          defaultValue="0"
          className="w-28 border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        />
      </div>
      <label className="flex items-center gap-2 pb-2 text-sm text-brand-text">
        <input type="checkbox" name="is_default" />
        Predeterminada
      </label>
      <button
        type="submit"
        disabled={pending}
        className="bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Agregando…" : "Agregar tasa"}
      </button>
      {state.error && <p className="w-full text-sm text-brand-danger">{state.error}</p>}
    </form>
  );
}
