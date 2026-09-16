"use client";

import { useActionState } from "react";
import { addCollectionHistoryAction, type ActionState } from "@/features/invoices/actions";
import { Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

const initialState: ActionState = { error: null };

const ACTION_LABELS: Record<string, string> = {
  CALL: "Llamada",
  EMAIL: "Correo",
  WHATSAPP: "WhatsApp",
  VISIT: "Visita",
  NOTE: "Nota",
  OTHER: "Otro",
};

export function AddCollectionHistoryForm({ invoiceId }: { invoiceId: string }) {
  const addWithId = addCollectionHistoryAction.bind(null, invoiceId);
  const [state, formAction, pending] = useActionState(addWithId, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <Select label="Medio" name="action" defaultValue="CALL" className="w-36">
        {Object.entries(ACTION_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </Select>
      <Input label="Comentario" name="comment" className="w-56" />
      <Input label="Resultado" name="result" className="w-40" />
      <Input label="Próxima acción" name="next_action_date" type="date" className="w-40" />
      <Button type="submit" loading={pending}>
        Registrar
      </Button>
      {state.error && <p className="w-full text-sm text-brand-danger">{state.error}</p>}
    </form>
  );
}
