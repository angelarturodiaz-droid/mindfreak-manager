"use client";

import { useActionState } from "react";
import { registerSupplierPaymentAction, type ActionState } from "@/features/payments/actions";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@/features/payments/schema";
import { Input, Select } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { Button } from "@/components/ui/button";
import { todayISO } from "@/lib/utils/dates";

const initialState: ActionState = { error: null };

type BankAccount = { id: string; name: string; bank_name: string | null; currency: string };
type BankCatalogEntry = { id: string; name: string };

export function RegisterSupplierPaymentForm({
  expenseId,
  supplierId,
  projectId,
  balance,
  currency,
  bankAccounts,
  bankCatalog,
}: {
  expenseId: string;
  supplierId: string | null;
  projectId: string | null;
  balance: number;
  currency: string;
  bankAccounts: BankAccount[];
  bankCatalog: BankCatalogEntry[];
}) {
  const registerWithIds = registerSupplierPaymentAction.bind(
    null,
    expenseId,
    supplierId,
    projectId,
  );
  const [state, formAction, pending] = useActionState(registerWithIds, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <Input label="Fecha" name="payment_date" type="date" required defaultValue={todayISO()} />
      <MoneyInput
        label="Monto"
        name="amount"
        min={0.01}
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
      <Select
        label="Banco del proveedor (opcional)"
        name="payee_bank_name"
        defaultValue=""
        hint="A dónde se le depositó a él, no tu cuenta de origen."
        className="w-56"
      >
        <option value="">Sin especificar</option>
        {bankCatalog.map((b) => (
          <option key={b.id} value={b.name}>
            {b.name}
          </option>
        ))}
      </Select>
      <Button type="submit" loading={pending}>
        Registrar pago
      </Button>
      {state.error && <p className="w-full text-sm text-brand-danger">{state.error}</p>}
    </form>
  );
}
