"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  convertQuotationToProjectAction,
  type ActionState,
} from "@/features/projects/actions";

const initialState: ActionState = { error: null };

type Member = { id: string; full_name: string | null; email: string | null };

export function ConvertQuotationForm({
  quotationId,
  members,
  suggestedName,
}: {
  quotationId: string;
  members: Member[];
  suggestedName: string;
}) {
  const convertWithId = convertQuotationToProjectAction.bind(null, quotationId);
  const [state, formAction, pending] = useActionState(convertWithId, initialState);

  return (
    <form action={formAction} className="max-w-md space-y-4">
      <div>
        <label className="block text-sm font-medium text-brand-text">
          Nombre del proyecto/evento *
        </label>
        <input
          name="name"
          required
          defaultValue={suggestedName}
          className="mt-1 w-full border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-brand-text">
          Responsable (manager)
        </label>
        <select
          name="manager_id"
          defaultValue=""
          className="mt-1 w-full border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        >
          <option value="">Sin asignar</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.full_name || m.email}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-sm font-medium text-brand-text">
            Fecha del evento
          </label>
          <input
            name="event_date"
            type="date"
            className="mt-1 w-full border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-brand-text">
            Hora
          </label>
          <input
            name="event_time"
            type="time"
            className="mt-1 w-full border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-brand-text">Lugar</label>
        <input
          name="location_name"
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
          Presupuesto
        </label>
        <input
          name="budget"
          type="number"
          step="0.01"
          min="0"
          defaultValue="0"
          className="mt-1 w-full border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-brand-text">Notas</label>
        <textarea
          name="notes"
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
          {pending ? "Convirtiendo…" : "Convertir en proyecto"}
        </button>
        <Link
          href="/projects"
          className="px-4 py-2 text-sm text-brand-muted hover:text-brand-text"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
