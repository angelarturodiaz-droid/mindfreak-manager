"use client";

import { useState } from "react";
import { useOverdraftConfirmAction } from "@/components/ui/overdraft-confirm";
import { transferAdvanceAction, type AdvanceActionState } from "@/features/advances/actions";
import { Select, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { FormFooter } from "@/components/payments/form-section";

const initialState: AdvanceActionState = { error: null };

/** Pasar el anticipo a otro proyecto o cotización del mismo cliente (no mueve dinero). */
export function TransferAdvanceForm({
  advanceId,
  options,
}: {
  advanceId: string;
  options: { value: string; label: string }[];
}) {
  const [state, formAction, pending, dialogs, formKey] = useOverdraftConfirmAction(
    transferAdvanceAction.bind(null, advanceId),
    initialState,
  );
  const [target, setTarget] = useState("");
  return (
    <form key={formKey} action={formAction} className="space-y-3">
      <Select
        label="Pasar a"
        name="target"
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        required
        hint="Solo aparecen proyectos y cotizaciones aprobadas del mismo cliente y en la misma moneda."
      >
        <option value="">Elige…</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
      <Textarea label="Motivo" name="reason" rows={2} required placeholder="Ej. El cliente movió el evento a otra fecha" />
      <FormFooter error={state.error}>
        <Button type="submit" loading={pending} disabled={!target}>
          Pasar anticipo
        </Button>
      </FormFooter>
      {dialogs}
    </form>
  );
}
