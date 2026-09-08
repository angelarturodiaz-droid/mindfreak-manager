"use client";

import { useActionState } from "react";
import { updateProjectHeaderAction, type ActionState } from "@/features/projects/actions";

const initialState: ActionState = { error: null };

type Member = { id: string; full_name: string | null; email: string | null };

export function ProjectEditForm({
  project,
  members,
}: {
  project: {
    id: string;
    name: string;
    client_id: string;
    manager_id: string | null;
    event_date: string | null;
    event_time: string | null;
    location_name: string | null;
    address: string | null;
    budget: number;
    notes: string | null;
  };
  members: Member[];
}) {
  const updateWithId = updateProjectHeaderAction.bind(null, project.id);
  const [state, formAction, pending] = useActionState(updateWithId, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="client_id" value={project.client_id} />

      <div>
        <label className="block text-sm font-medium text-brand-text">Nombre</label>
        <input
          name="name"
          defaultValue={project.name}
          required
          className="mt-1 w-full border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-brand-text">
          Responsable (manager)
        </label>
        <select
          name="manager_id"
          defaultValue={project.manager_id ?? ""}
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
            defaultValue={project.event_date ?? ""}
            className="mt-1 w-full border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-brand-text">Hora</label>
          <input
            name="event_time"
            type="time"
            defaultValue={project.event_time ?? ""}
            className="mt-1 w-full border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-brand-text">Lugar</label>
        <input
          name="location_name"
          defaultValue={project.location_name ?? ""}
          className="mt-1 w-full border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-brand-text">
          Dirección
        </label>
        <input
          name="address"
          defaultValue={project.address ?? ""}
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
          defaultValue={project.budget}
          className="mt-1 w-full border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-brand-text">Notas</label>
        <textarea
          name="notes"
          rows={3}
          defaultValue={project.notes ?? ""}
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
