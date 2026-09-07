"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createClientAction, type ActionState } from "@/features/clients/actions";

const initialState: ActionState = { error: null };

export default function NewClientPage() {
  const [state, formAction, pending] = useActionState(
    createClientAction,
    initialState,
  );

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div>
        <h1 className="text-xl font-semibold text-brand-primary">Nuevo cliente</h1>
        <p className="text-sm text-brand-muted">
          Puedes registrarlo como cliente potencial (lead) si aún no se ha
          concretado ningún negocio.
        </p>
      </div>

      <form action={formAction} className="max-w-md space-y-4">
        <div>
          <label className="block text-sm font-medium text-brand-text">
            Nombre *
          </label>
          <input
            name="name"
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
            className="mt-1 w-full border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-brand-text">
            Teléfono
          </label>
          <input
            name="phone"
            className="mt-1 w-full border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-brand-text">
            Dirección
          </label>
          <input
            name="address"
            className="mt-1 w-full border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-brand-text">
            Estado inicial
          </label>
          <select
            name="status"
            defaultValue="LEAD"
            className="mt-1 w-full border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
          >
            <option value="LEAD">Cliente potencial (lead)</option>
            <option value="ACTIVE">Cliente activo</option>
          </select>
        </div>

        {state.error && <p className="text-sm text-brand-danger">{state.error}</p>}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={pending}
            className="bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Guardando…" : "Guardar cliente"}
          </button>
          <Link
            href="/clients"
            className="px-4 py-2 text-sm text-brand-muted hover:text-brand-text"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </main>
  );
}
