"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { createInvoiceAction, type ActionState } from "@/features/invoices/actions";

const initialState: ActionState = { error: null };
const today = new Date().toISOString().slice(0, 10);

type Client = { id: string; name: string };
type Project = {
  id: string;
  number: string;
  name: string;
  client_id: string;
  clients: { name: string }[] | { name: string } | null;
};

export function NewInvoiceForm({
  clients,
  projects,
}: {
  clients: Client[];
  projects: Project[];
}) {
  const [state, formAction, pending] = useActionState(
    createInvoiceAction,
    initialState,
  );
  const [useProject, setUseProject] = useState(false);

  return (
    <form action={formAction} className="max-w-md space-y-4">
      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-1">
          <input
            type="radio"
            checked={!useProject}
            onChange={() => setUseProject(false)}
          />
          Cliente directo
        </label>
        <label className="flex items-center gap-1">
          <input
            type="radio"
            checked={useProject}
            onChange={() => setUseProject(true)}
          />
          Desde un proyecto
        </label>
      </div>

      {!useProject ? (
        <div>
          <label className="block text-sm font-medium text-brand-text">
            Cliente *
          </label>
          <select
            name="client_id"
            required={!useProject}
            defaultValue=""
            className="mt-1 w-full border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
          >
            <option value="" disabled>
              Selecciona un cliente…
            </option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div>
          <label className="block text-sm font-medium text-brand-text">
            Proyecto *
          </label>
          <select
            name="project_id"
            required={useProject}
            defaultValue=""
            className="mt-1 w-full border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
          >
            <option value="" disabled>
              Selecciona un proyecto…
            </option>
            {projects.map((p) => {
              const clientData = Array.isArray(p.clients) ? p.clients[0] : p.clients;
              return (
                <option key={p.id} value={p.id}>
                  {p.number} — {p.name} ({clientData?.name ?? "—"})
                </option>
              );
            })}
          </select>
        </div>
      )}

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
          Fecha de vencimiento
        </label>
        <input
          name="due_date"
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

      <p className="text-xs text-brand-muted">
        NCF/ITBIS: campos preparados, no activos en producción todavía (F0,
        sección R). Se pueden completar después en el detalle.
      </p>

      {state.error && <p className="text-sm text-brand-danger">{state.error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Creando…" : "Crear factura"}
        </button>
        <Link
          href="/invoices"
          className="px-4 py-2 text-sm text-brand-muted hover:text-brand-text"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
