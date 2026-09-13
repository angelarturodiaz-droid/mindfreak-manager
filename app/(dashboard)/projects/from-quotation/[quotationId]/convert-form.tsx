"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  convertQuotationToProjectAction,
  type ActionState,
} from "@/features/projects/actions";
import { Input, Select, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

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
      <Input label="Nombre del proyecto/evento" name="name" required defaultValue={suggestedName} />

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
      <Input label="Presupuesto" name="budget" type="number" step="0.01" min="0" defaultValue="0" />
      <Textarea label="Notas" name="notes" rows={3} />

      {state.error && <p className="text-sm text-brand-danger">{state.error}</p>}

      <div className="flex gap-3">
        <Button type="submit" loading={pending}>
          Convertir en proyecto
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
