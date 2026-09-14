"use client";

import { useActionState } from "react";
import { registerPaymentAction, type ActionState } from "@/features/payments/actions";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@/features/payments/schema";
import { Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

const initialState: ActionState = { error: null };
const today = new Date().toISOString().slice(0, 10);

type BankAccount = { id: string; name: string; bank_name: string | null; currency: string };

export function RegisterPaymentForm({
  invoiceId,
  clientId,
  projectId,
  balance,
  currency,
  bankAccounts,
}: {
  invoiceId: string;
  clientId: string;
  projectId: string | null;
  balance: number;
  currency: string;
  bankAccounts: BankAccount[];
}) {
  const registerWithIds = registerPaymentAction.bind(null, invoiceId, clientId, projectId);
  const [state, formAction, pending] = useActionState(registerWithIds, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <Input label="Fecha" name="payment_date" type="date" required defaultValue={today} />
      <Input
        label="Monto"
        name="amount"
        type="number"
        step="0.01"
        min="0.01"
        max={balance}
        required
        defaultValue={balance}
        hint={`Máx. ${balance.toFixed(2)} ${currency}`}
        className="w-40"
      />
      <Select label="Método" name="method" defaultValue="TRANSFER">
        {PAYMENT_METHODS.map((m) => (
          <option key={m} value={m}>
            {PAYMENT_METHOD_LABELS[m]}
          </option>
        ))}
      </Select>
      <Select label="Cuenta bancaria" name="bank_account_id" required defaultValue="">
        <option value="" disabled>
          Selecciona una cuenta…
        </option>
        {bankAccounts.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name} ({b.bank_name})
          </option>
        ))}
      </Select>
      <Input label="Referencia" name="reference" />
      <Button type="submit" loading={pending}>
        Registrar cobro
      </Button>
      {state.error && <p className="w-full text-sm text-brand-danger">{state.error}</p>}
    </form>
  );
}
