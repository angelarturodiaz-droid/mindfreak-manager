"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createQuotationAction, type ActionState } from "@/features/quotations/actions";
import { Input, Select, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

const initialState: ActionState = { error: null };
const today = new Date().toISOString().slice(0, 10);

export function NewQuotationForm({
  clients,
}: {
  clients: { id: string; name: string; status: string }[];
}) {
  const [state, formAction, pending] = useActionState(
    createQuotationAction,
    initialState,
  );

  return (
    <form action={formAction} className="max-w-md space-y-4">
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

      <Input label="Fecha de emisión" name="issue_date" type="date" required defaultValue={today} />
      <Input label="Válida hasta" name="valid_until" type="date" />

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

      <Textarea label="Condiciones / Notas" name="terms" rows={3} />

      {state.error && <p className="text-sm text-brand-danger">{state.error}</p>}

      <div className="flex gap-3">
        <Button type="submit" loading={pending}>
          Crear cotización
        </Button>
        <Link href="/quotations">
          <Button type="button" variant="ghost">
            Cancelar
          </Button>
        </Link>
      </div>
      <p className="text-xs text-brand-muted">
        Después de crearla, agregas las líneas de servicio en la pantalla de
        detalle.
      </p>
    </form>
  );
}
