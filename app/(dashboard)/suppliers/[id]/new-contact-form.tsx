"use client";

import { useActionState } from "react";
import {
  createSupplierContactAction,
  type ActionState,
} from "@/features/suppliers/actions";

const initialState: ActionState = { error: null };

export function NewSupplierContactForm({ supplierId }: { supplierId: string }) {
  const createWithId = createSupplierContactAction.bind(null, supplierId);
  const [state, formAction, pending] = useActionState(createWithId, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <input
        name="full_name"
        placeholder="Nombre completo"
        required
        className="border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
      />
      <input
        name="position"
        placeholder="Cargo"
        className="border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
      />
      <input
        name="email"
        type="email"
        placeholder="Correo"
        className="border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
      />
      <input
        name="phone"
        placeholder="Teléfono"
        className="border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
      />
      <label className="flex items-center gap-1 text-sm text-brand-muted">
        <input type="checkbox" name="is_primary" />
        Principal
      </label>
      <button
        type="submit"
        disabled={pending}
        className="border border-brand-muted/30 px-4 py-2 text-sm text-brand-text hover:border-brand-accent disabled:opacity-50"
      >
        {pending ? "Agregando…" : "Agregar contacto"}
      </button>
      {state.error && <p className="w-full text-sm text-brand-danger">{state.error}</p>}
    </form>
  );
}
