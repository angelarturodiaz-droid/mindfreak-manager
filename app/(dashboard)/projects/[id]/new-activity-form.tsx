"use client";

import { useActionState } from "react";
import { createProjectActivityAction, type ActionState } from "@/features/activities/actions";
import { ACTIVITY_TYPES } from "@/features/activities/schema";

const initialState: ActionState = { error: null };

const TYPE_LABELS: Record<string, string> = {
  CALL: "Llamada",
  MEETING: "Reunión",
  EMAIL: "Correo",
  NOTE: "Nota",
  OTHER: "Otro",
};

export function NewActivityForm({
  projectId,
  revalidatePathValue,
}: {
  projectId: string;
  revalidatePathValue: string;
}) {
  const createWithProject = createProjectActivityAction.bind(
    null,
    projectId,
    revalidatePathValue,
  );
  const [state, formAction, pending] = useActionState(createWithProject, initialState);

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-3">
      <div>
        <label className="block text-xs text-brand-muted">Tipo</label>
        <select
          name="type"
          defaultValue="NOTE"
          className="w-48 border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        >
          {ACTIVITY_TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs text-brand-muted">Descripción</label>
        <textarea
          name="description"
          required
          rows={4}
          placeholder="¿Qué pasó? Puedes escribir con detalle."
          className="w-full resize-y border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="w-fit bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Guardando…" : "Registrar"}
      </button>
      {state.error && <p className="text-sm text-brand-danger">{state.error}</p>}
    </form>
  );
}
