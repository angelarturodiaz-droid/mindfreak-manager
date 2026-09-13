"use client";

import { useActionState } from "react";
import { updateOrganizationAction, type ActionState } from "@/features/settings/actions";

const initialState: ActionState = { error: null };

export function OrganizationForm({
  company,
}: {
  company: {
    legal_name: string | null;
    tax_id: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    base_currency: string;
  };
}) {
  const [state, formAction, pending] = useActionState(updateOrganizationAction, initialState);

  return (
    <form action={formAction} className="max-w-md space-y-4">
      <div>
        <label className="block text-sm font-medium text-brand-text">
          Nombre legal
        </label>
        <input
          name="legal_name"
          defaultValue={company.legal_name ?? ""}
          className="mt-1 w-full border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-brand-text">RNC</label>
        <input
          name="tax_id"
          defaultValue={company.tax_id ?? ""}
          className="mt-1 w-full border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-brand-text">
          Dirección
        </label>
        <input
          name="address"
          defaultValue={company.address ?? ""}
          className="mt-1 w-full border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-brand-text">
            Teléfono
          </label>
          <input
            name="phone"
            defaultValue={company.phone ?? ""}
            className="mt-1 w-full border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-brand-text">
            Correo
          </label>
          <input
            name="email"
            type="email"
            defaultValue={company.email ?? ""}
            className="mt-1 w-full border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-brand-text">
          Moneda base
        </label>
        <select
          name="base_currency"
          defaultValue={company.base_currency}
          className="mt-1 w-full border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        >
          <option value="DOP">DOP — Peso dominicano</option>
          <option value="USD">USD — Dólar</option>
        </select>
        <p className="mt-1 text-xs text-brand-muted">
          Usada para consolidar reportes, dashboard y rentabilidad. Cambiarla
          no convierte montos ya registrados.
        </p>
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
