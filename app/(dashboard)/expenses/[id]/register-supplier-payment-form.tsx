"use client";

import { useActionState } from "react";
import { registerSupplierPaymentAction, type ActionState } from "@/features/payments/actions";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@/features/payments/schema";

const initialState: ActionState = { error: null };
const today = new Date().toISOString().slice(0, 10);

type BankAccount = { id: string; name: string; bank_name: string | null; currency: string };

export function RegisterSupplierPaymentForm({
  expenseId,
  supplierId,
  projectId,
  balance,
  currency,
  bankAccounts,
}: {
  expenseId: string;
  supplierId: string | null;
  projectId: string | null;
  balance: number;
  currency: string;
  bankAccounts: BankAccount[];
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
      <div>
        <label className="block text-xs text-brand-muted">Fecha</label>
        <input
          name="payment_date"
          type="date"
          required
          defaultValue={today}
          className="border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        />
      </div>
      <div>
        <label className="block text-xs text-brand-muted">
          Monto (máx. {balance.toFixed(2)} {currency})
        </label>
        <input
          name="amount"
          type="number"
          step="0.01"
          min="0.01"
          max={balance}
          required
          defaultValue={balance}
          className="w-32 border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        />
      </div>
      <div>
        <label className="block text-xs text-brand-muted">Método</label>
        <select
          name="method"
          defaultValue="TRANSFER"
          className="border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        >
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {PAYMENT_METHOD_LABELS[m]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs text-brand-muted">Cuenta bancaria</label>
        <select
          name="bank_account_id"
          defaultValue=""
          className="border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        >
          <option value="">Sin cuenta</option>
          {bankAccounts.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} ({b.bank_name})
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs text-brand-muted">Referencia</label>
        <input
          name="reference"
          className="border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Registrando…" : "Registrar pago"}
      </button>
      {state.error && <p className="w-full text-sm text-brand-danger">{state.error}</p>}
    </form>
  );
}
