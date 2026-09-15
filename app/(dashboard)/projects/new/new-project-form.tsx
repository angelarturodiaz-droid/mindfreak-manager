"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createProjectAction, type ActionState } from "@/features/projects/actions";
import { Input, Select, Textarea } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { Button } from "@/components/ui/button";

const initialState: ActionState = { error: null };

type Client = { id: string; name: string; status: string };
type Member = { id: string; full_name: string | null; email: string | null };

export function NewProjectForm({
  clients,
  members,
}: {
  clients: Client[];
  members: Member[];
}) {
  const [state, formAction, pending] = useActionState(
    createProjectAction,
    initialState,
  );

  return (
    <form action={formAction} className="max-w-md space-y-4">
      <Input label="Nombre del proyecto/evento" name="name" required />

      <Select label="Cliente" name="client_id" required defaultValue="">
        <option value="" disabled>
          Selecciona un cliente…
        </option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} {c.status === "LEAD" ? "(lead)" : ""}
          </option>
        ))}
      </Select>

      <Select label="Responsable (manager)" name="manager_id" defaultValue="">
        <option value="">Sin asignar</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.full_name || m.email}
          </option>
        ))}
      </Select>

      <div className="flex gap-3">
        <Input label="Fecha del evento" name="event_date" type="date" className="flex-1" />
        <Input label="Hora" name="event_time" type="time" className="flex-1" />
      </div>

      <Input label="Lugar" name="location_name" />
      <Input label="Dirección" name="address" />
      <MoneyInput label="Presupuesto" name="budget" min={0} defaultValue={0} />
      <Textarea label="Notas" name="notes" rows={3} />

      {state.error && <p className="text-sm text-brand-danger">{state.error}</p>}

      <div className="flex gap-3">
        <Button type="submit" loading={pending}>
          Crear proyecto
        </Button>
        <Link href="/projects">
          <Button type="button" variant="ghost">
            Cancelar
          </Button>
        </Link>
      </div>
    </form>
  );
}
