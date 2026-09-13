"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";
import {
  updateActivityAction,
  deleteActivityAction,
  type ActionState as UpdateActionState,
} from "@/features/activities/actions";
import { ACTIVITY_TYPES } from "@/features/activities/schema";
import { Select, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/confirm-button";

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

  if (editing) {
    return (
      <li>
        <Card className="border-brand-accent/40">
          <form action={formAction} className="flex flex-col gap-2">
            <Select name="type" defaultValue={activity.type} className="w-48">
              {ACTIVITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
            <Textarea name="description" defaultValue={activity.description} rows={3} required />
            <div className="flex gap-3">
              <Button type="submit" size="sm" loading={formPending}>
                Guardar
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
                Cancelar
              </Button>
            </div>
            {state.error && <p className="text-sm text-brand-danger">{state.error}</p>}
          </form>
        </Card>
      </li>
    );
  }

  return (
    <li>
      <Card className="text-sm">
        <p className="whitespace-pre-wrap">{activity.description}</p>
        <div className="mt-1 flex items-center justify-between">
          <p className="text-xs text-brand-muted">
            {TYPE_LABELS[activity.type] ?? activity.type} ·{" "}
            {new Date(activity.activity_date).toLocaleString("es-DO")}
            {author?.full_name && ` · ${author.full_name}`}
          </p>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" icon={<Pencil size={12} />} onClick={() => setEditing(true)}>
              Editar
            </Button>
            <ConfirmButton
              label="Eliminar"
              confirmTitle="¿Eliminar esta actividad?"
              confirmMessage="No se puede deshacer."
              onConfirm={() => deleteActivityAction(activity.id, revalidatePathValue)}
            />
          </div>
        </div>
      </Card>
    </li>
  );
}
