"use client";

import { useActionState } from "react";
import { updateProjectHeaderAction, type ActionState } from "@/features/projects/actions";
import { Input, Select, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

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

      <Input label="Nombre" name="name" defaultValue={project.name} required />

      <Select label="Responsable (manager)" name="manager_id" defaultValue={project.manager_id ?? ""}>
        <option value="">Sin asignar</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.full_name || m.email}
          </option>
        ))}
      </Select>

      <div className="flex gap-3">
        <Input
          label="Fecha del evento"
          name="event_date"
          type="date"
          defaultValue={project.event_date ?? ""}
          className="flex-1"
        />
        <Input label="Hora" name="event_time" type="time" defaultValue={project.event_time ?? ""} className="flex-1" />
      </div>

      <Input label="Lugar" name="location_name" defaultValue={project.location_name ?? ""} />
      <Input label="Dirección" name="address" defaultValue={project.address ?? ""} />
      <Input label="Presupuesto" name="budget" type="number" step="0.01" min="0" defaultValue={project.budget} />
      <Textarea label="Notas" name="notes" rows={3} defaultValue={project.notes ?? ""} />

      {state.error && <p className="text-sm text-brand-danger">{state.error}</p>}

      <Button type="submit" loading={pending}>
        Guardar cambios
      </Button>
    </form>
  );
}
