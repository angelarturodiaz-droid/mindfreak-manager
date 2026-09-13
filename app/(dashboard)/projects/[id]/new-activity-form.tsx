"use client";

import { useActionState } from "react";
import { createProjectActivityAction, type ActionState } from "@/features/activities/actions";
import { ACTIVITY_TYPES } from "@/features/activities/schema";
import { Select, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

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
      <Select label="Tipo" name="type" defaultValue="NOTE" className="w-48">
        {ACTIVITY_TYPES.map((t) => (
          <option key={t} value={t}>
            {TYPE_LABELS[t]}
          </option>
        ))}
      </Select>
      <Textarea
        label="Descripción"
        name="description"
        required
        rows={4}
        placeholder="¿Qué pasó? Puedes escribir con detalle."
      />
      <Button type="submit" loading={pending} className="w-fit">
        Registrar
      </Button>
      {state.error && <p className="text-sm text-brand-danger">{state.error}</p>}
    </form>
  );
}
