"use client";

import { useActionState } from "react";
import { updateSupplierAction, type ActionState } from "@/features/suppliers/actions";

const initialState: ActionState = { error: null };

export function SupplierEditForm({
  supplier,
}: {
  supplier: {
    id: string;
    name: string;
    tax_id: string | null;
    category: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
  };
}) {
  const updateWithId = updateSupplierAction.bind(null, supplier.id);
  const [state, formAction, pending] = useActionState(updateWithId, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-brand-text">Nombre</label>
        <input
          name="name"
          defaultValue={supplier.name}
          required
          className="mt-1 w-full border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-brand-text">
          RNC / Cédula
        </label>
        <input
          name="tax_id"
          defaultValue={supplier.tax_id ?? ""}
          className="mt-1 w-full border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-brand-text">
          Categoría
        </label>
        <input
          name="category"
          defaultValue={supplier.category ?? ""}
          className="mt-1 w-full border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-brand-text">Correo</label>
        <input
          name="email"
          type="email"
          defaultValue={supplier.email ?? ""}
          className="mt-1 w-full border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-brand-text">
          Teléfono
        </label>
        <input
          name="phone"
          defaultValue={supplier.phone ?? ""}
          className="mt-1 w-full border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-brand-text">
          Dirección
        </label>
        <input
          name="address"
          defaultValue={supplier.address ?? ""}
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
