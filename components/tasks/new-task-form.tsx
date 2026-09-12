"use client";

import { useActionState } from "react";
import { createTaskAction, type ActionState } from "@/features/tasks/actions";
import { TASK_PRIORITIES } from "@/features/tasks/schema";

const initialState: ActionState = { error: null };

const PRIORITY_LABELS: Record<string, string> = {
  LOW: "Baja",
  MEDIUM: "Media",
  HIGH: "Alta",
};

type Member = { id: string; full_name: string | null; email: string | null };
type ProjectOption = { id: string; number: string; name: string };

export function NewTaskForm({
  members,
  projects,
  defaultProjectId,
  revalidatePathValue,
}: {
  members: Member[];
  projects?: ProjectOption[];
  defaultProjectId?: string;
  revalidatePathValue: string;
}) {
  const createWithPath = createTaskAction.bind(null, revalidatePathValue);
  const [state, formAction, pending] = useActionState(createWithPath, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <div>
        <label className="block text-xs text-brand-muted">Título</label>
        <input
          name="title"
          required
          className="border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        />
      </div>
      {projects && (
        <div>
          <label className="block text-xs text-brand-muted">Proyecto</label>
          <select
            name="project_id"
            defaultValue={defaultProjectId ?? ""}
            className="border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
          >
            <option value="">Sin proyecto (tarea general)</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.number} — {p.name}
              </option>
            ))}
          </select>
        </div>
      )}
      {defaultProjectId && !projects && (
        <input type="hidden" name="project_id" value={defaultProjectId} />
      )}
      <div>
        <label className="block text-xs text-brand-muted">Asignado a</label>
        <select
          name="assigned_to"
          defaultValue=""
          className="border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        >
          <option value="">Sin asignar</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.full_name ?? m.email ?? "Usuario"}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs text-brand-muted">Fecha límite</label>
        <input
          name="due_date"
          type="date"
          className="border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        />
      </div>
      <div>
        <label className="block text-xs text-brand-muted">Prioridad</label>
        <select
          name="priority"
          defaultValue="MEDIUM"
          className="border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        >
          {TASK_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABELS[p]}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Creando…" : "Crear tarea"}
      </button>
      {state.error && <p className="w-full text-sm text-brand-danger">{state.error}</p>}
    </form>
  );
}
