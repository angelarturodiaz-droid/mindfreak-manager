"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { createInvoiceAction, type ActionState } from "@/features/invoices/actions";
import { Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

const initialState: ActionState = { error: null };
const today = new Date().toISOString().slice(0, 10);

type Client = { id: string; name: string };
type Project = {
  id: string;
  number: string;
  name: string;
  client_id: string;
  clients: { name: string }[] | { name: string } | null;
};

export function NewInvoiceForm({
  clients,
  projects,
}: {
  clients: Client[];
  projects: Project[];
}) {
  const [state, formAction, pending] = useActionState(
    createInvoiceAction,
    initialState,
  );
  const [useProject, setUseProject] = useState(false);

  return (
    <form action={formAction} className="max-w-md space-y-4">
      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-1">
          <input
            type="radio"
            checked={!useProject}
            onChange={() => setUseProject(false)}
          />
          Cliente directo
        </label>
        <label className="flex items-center gap-1">
          <input
            type="radio"
            checked={useProject}
            onChange={() => setUseProject(true)}
          />
          Desde un proyecto
        </label>
      </div>

      {!useProject ? (
        <Select label="Cliente" name="client_id" required={!useProject} defaultValue="">
          <option value="" disabled>
            Selecciona un cliente…
          </option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      ) : (
        <Select label="Proyecto" name="project_id" required={useProject} defaultValue="">
          <option value="" disabled>
            Selecciona un proyecto…
          </option>
          {projects.map((p) => {
            const clientData = Array.isArray(p.clients) ? p.clients[0] : p.clients;
            return (
              <option key={p.id} value={p.id}>
                {p.number} — {p.name} ({clientData?.name ?? "—"})
              </option>
            );
          })}
        </Select>
      )}

      <Input label="Fecha de emisión" name="issue_date" type="date" required defaultValue={today} />
      <Input label="Fecha de vencimiento" name="due_date" type="date" />

      <div className="flex gap-3">
        <Select label="Moneda" name="currency" defaultValue="DOP" className="flex-1">
          <option value="DOP">DOP</option>
          <option value="USD">USD</option>
        </Select>
        <Input
          label="Tasa de cambio"
          name="exchange_rate"
          type="number"
          step="0.000001"
          min="0"
          defaultValue="1"
          className="flex-1"
        />
      </div>

      <p className="text-xs text-brand-muted">
        NCF/ITBIS: campos preparados, no activos en producción todavía (F0,
        sección R). Se pueden completar después en el detalle.
      </p>

      {state.error && <p className="text-sm text-brand-danger">{state.error}</p>}

      <div className="flex gap-3">
        <Button type="submit" loading={pending}>
          Crear factura
        </Button>
        <Link href="/invoices">
          <Button type="button" variant="ghost">
            Cancelar
          </Button>
        </Link>
      </div>
    </form>
  );
}
