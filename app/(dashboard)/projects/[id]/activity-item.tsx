"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  updateActivityAction,
  deleteActivityAction,
  type ActionState as UpdateActionState,
} from "@/features/activities/actions";
import { ACTIVITY_TYPES } from "@/features/activities/schema";

const TYPE_LABELS: Record<string, string> = {
  CALL: "Llamada",
  MEETING: "Reunión",
  EMAIL: "Correo",
  NOTE: "Nota",
  OTHER: "Otro",
};

const initialState: UpdateActionState = { error: null };

type Activity = {
  id: string;
  type: string;
  description: string;
  activity_date: string;
  profiles?: { full_name: string | null } | { full_name: string | null }[] | null;
};

export function ActivityItem({
  activity,
  revalidatePathValue,
}: {
  activity: Activity;
  revalidatePathValue: string;
}) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const updateWithId = updateActivityAction.bind(null, activity.id, revalidatePathValue);
  const [state, formAction, formPending] = useActionState(updateWithId, initialState);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !formPending && !state.error) {
      setEditing(false);
    }
    wasPending.current = formPending;
  }, [formPending, state.error]);

  const author = Array.isArray(activity.profiles) ? activity.profiles[0] : activity.profiles;

  function handleDelete() {
    if (!window.confirm("¿Eliminar esta actividad? No se puede deshacer.")) return;
    startTransition(() => deleteActivityAction(activity.id, revalidatePathValue));
  }

  if (editing) {
    return (
      <li className="border border-brand-accent/40 px-3 py-3">
        <form action={formAction} className="flex flex-col gap-2">
          <select
            name="type"
            defaultValue={activity.type}
            className="w-48 border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
          >
            {ACTIVITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          <textarea
            name="description"
            defaultValue={activity.description}
            rows={3}
            required
            className="w-full resize-y border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
          />
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={formPending}
              className="bg-brand-primary px-3 py-1.5 text-sm text-white hover:opacity-90 disabled:opacity-50"
            >
              {formPending ? "Guardando…" : "Guardar"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-sm text-brand-muted hover:text-brand-text"
            >
              Cancelar
            </button>
          </div>
          {state.error && <p className="text-sm text-brand-danger">{state.error}</p>}
        </form>
      </li>
    );
  }

  return (
    <li className="border border-brand-muted/20 px-3 py-3 text-sm">
      <p className="whitespace-pre-wrap">{activity.description}</p>
      <div className="mt-1 flex items-center justify-between">
        <p className="text-xs text-brand-muted">
          {TYPE_LABELS[activity.type] ?? activity.type} ·{" "}
          {new Date(activity.activity_date).toLocaleString("es-DO")}
          {author?.full_name && ` · ${author.full_name}`}
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs text-brand-accent hover:underline"
          >
            Editar
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            className="text-xs text-brand-muted hover:text-brand-danger disabled:opacity-50"
          >
            Eliminar
          </button>
        </div>
      </div>
    </li>
  );
}
