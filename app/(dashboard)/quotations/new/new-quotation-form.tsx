"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createQuotationAction, type ActionState } from "@/features/quotations/actions";

const initialState: ActionState = { error: null };
const today = new Date().toISOString().slice(0, 10);

export function NewQuotationForm({
  clients,
}: {
  clients: { id: string; name: string; status: string }[];
}) {
  const [state, formAction, pending] = useActionState(
    createQuotationAction,
    initialState,
  );

  return (
    <form action={formAction} className="max-w-md space-y-4">
      <div>
        <label className="block text-sm font-medium text-brand-text">
          Cliente *
        </label>
        <select
          name="client_id"
          required
          defaultValue=""
          className="mt-1 w-full border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        >
          <option value="" disabled>
            Selecciona un cliente…
          </option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} {c.status === "LEAD" ? "(lead)" : ""}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-brand-text">
          Fecha de emisión *
        </label>
        <input
          name="issue_date"
          type="date"
          required
          defaultValue={today}
          className="mt-1 w-full border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-brand-text">
          Válida hasta
        </label>
        <input
          name="valid_until"
          type="date"
          className="mt-1 w-full border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        />
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-sm font-medium text-brand-text">
            Moneda
          </label>
          <select
            name="currency"
            defaultValue="DOP"
            className="mt-1 w-full border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
          >
            <option value="DOP">DOP</option>
            <option value="USD">USD</option>
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-brand-text">
            Tasa de cambio
          </label>
          <input
            name="exchange_rate"
            type="number"
            step="0.000001"
            min="0"
            defaultValue="1"
            className="mt-1 w-full border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-brand-text">
          Condiciones / Notas
        </label>
        <textarea
          name="terms"
          rows={3}
          className="mt-1 w-full border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        />
      </div>

      {state.error && <p className="text-sm text-brand-danger">{state.error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Creando…" : "Crear cotización"}
        </button>
        <Link
          href="/quotations"
          className="px-4 py-2 text-sm text-brand-muted hover:text-brand-text"
        >
          Cancelar
        </Link>
      </div>
      <p className="text-xs text-brand-muted">
        Después de crearla, agregas las líneas de servicio en la pantalla de
        detalle.
      </p>
    </form>
  );
}
