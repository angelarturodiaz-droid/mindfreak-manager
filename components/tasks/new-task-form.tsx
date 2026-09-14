"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { createTaskAction, type ActionState } from "@/features/tasks/actions";
import { TASK_PRIORITIES } from "@/features/tasks/schema";
import { Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

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
      <Input label="Título" name="title" required />
      {projects && (
        <Select label="Proyecto" name="project_id" defaultValue={defaultProjectId ?? ""}>
          <option value="">Sin proyecto (tarea general)</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.number} — {p.name}
            </option>
          ))}
        </Select>
      )}
      {defaultProjectId && !projects && (
        <input type="hidden" name="project_id" value={defaultProjectId} />
      )}
      <Select label="Asignado a" name="assigned_to" defaultValue="">
        <option value="">Sin asignar</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.full_name ?? m.email ?? "Usuario"}
          </option>
        ))}
      </Select>
      <Input label="Fecha límite" name="due_date" type="date" />
      <Select label="Prioridad" name="priority" defaultValue="MEDIUM">
        {TASK_PRIORITIES.map((p) => (
          <option key={p} value={p}>
            {PRIORITY_LABELS[p]}
          </option>
        ))}
      </Select>
      <Button type="submit" loading={pending} icon={<Plus size={14} />}>
        Crear tarea
      </Button>
      {state.error && <p className="w-full text-sm text-brand-danger">{state.error}</p>}
    </form>
  );
}
