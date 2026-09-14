"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { createManualTransactionAction, type ActionState } from "@/features/banks/actions";
import { Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

const initialState: ActionState = { error: null };
const today = new Date().toISOString().slice(0, 10);

export function ManualTransactionForm({ bankAccountId }: { bankAccountId: string }) {
  const createWithId = createManualTransactionAction.bind(null, bankAccountId);
  const [state, formAction, pending] = useActionState(createWithId, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <Select label="Tipo" name="type" defaultValue="INCOME">
        <option value="INCOME">Ingreso</option>
        <option value="EXPENSE">Gasto</option>
      </Select>
      <Input label="Fecha" name="transaction_date" type="date" required defaultValue={today} />
      <Input label="Monto" name="amount" type="number" step="0.01" min="0.01" required className="w-28" />
      <Input
        label="Descripción"
        name="description"
        required
        placeholder="Ej. Interés bancario, comisión..."
        className="w-56"
      />
      <Button type="submit" loading={pending} icon={<Plus size={14} />}>
        Agregar movimiento
      </Button>
      {state.error && <p className="w-full text-sm text-brand-danger">{state.error}</p>}
    </form>
  );
}
