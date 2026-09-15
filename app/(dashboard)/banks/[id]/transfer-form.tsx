"use client";

import { useActionState } from "react";
import { ArrowRightLeft } from "lucide-react";
import { createTransferAction, type ActionState } from "@/features/banks/actions";
import { Input, Select } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { Button } from "@/components/ui/button";

const initialState: ActionState = { error: null };
const today = new Date().toISOString().slice(0, 10);

type Account = { id: string; name: string; bank_name: string | null; currency: string; type: string };

export function TransferForm({
  fromAccountId,
  otherAccounts,
}: {
  fromAccountId: string;
  otherAccounts: Account[];
}) {
  const createWithId = createTransferAction.bind(null, fromAccountId);
  const [state, formAction, pending] = useActionState(createWithId, initialState);

  if (otherAccounts.length === 0) {
    return (
      <p className="text-sm text-brand-muted">
        Necesitas al menos otra cuenta activa para poder transferir entre
        cuentas.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <Select label="Cuenta destino" name="to_bank_account_id" required defaultValue="">
        <option value="" disabled>
          Selecciona…
        </option>
        {otherAccounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name} ({a.currency}){a.type === "CREDIT_CARD" ? " — Tarjeta" : ""}
          </option>
        ))}
      </Select>
      <Input label="Fecha" name="transaction_date" type="date" required defaultValue={today} />
      <MoneyInput label="Monto" name="amount" min={0.01} required defaultValue={0} className="w-28" />
      <Input label="Descripción" name="description" placeholder="Opcional" className="w-48" />
      <Button type="submit" loading={pending} icon={<ArrowRightLeft size={14} />}>
        Transferir
      </Button>
      {state.error && <p className="w-full text-sm text-brand-danger">{state.error}</p>}
    </form>
  );
}
