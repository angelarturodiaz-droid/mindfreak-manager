"use client";

import { useActionState } from "react";
import { registerPaymentAction, type ActionState } from "@/features/payments/actions";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@/features/payments/schema";
import { Input, Select } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { Button } from "@/components/ui/button";
import { todayISO } from "@/lib/utils/dates";

const initialState: ActionState = { error: null };

type BankAccount = { id: string; name: string; bank_name: string | null; currency: string };
type CategoryOption = { id: string; name: string };

/** Compara nombres sin mayúsculas ni acentos ("Cobro de Factura" = "cobro de factura"). */
function normalize(name: string) {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

export function RegisterPaymentForm({
  invoiceId,
  clientId,
  projectId,
  balance,
  currency,
  bankAccounts,
  categories,
}: {
  invoiceId: string;
  clientId: string;
  projectId: string | null;
  balance: number;
  currency: string;
  bankAccounts: BankAccount[];
  categories: CategoryOption[];
}) {
  const registerWithIds = registerPaymentAction.bind(null, invoiceId, clientId, projectId);
  const [state, formAction, pending] = useActionState(registerWithIds, initialState);
  // Por defecto "Cobro de factura" (lo mismo que pone el sistema si no se elige nada).
  const defaultCategory = categories.find((c) => normalize(c.name) === "cobro de factura");

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
      <Select
        label="Categoría"
        name="category_id"
        defaultValue={defaultCategory?.id ?? ""}
        hint="Cómo se clasifica el ingreso en Bancos y reportes"
      >
        {!defaultCategory && <option value="">Cobro de factura (automática)</option>}
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
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
