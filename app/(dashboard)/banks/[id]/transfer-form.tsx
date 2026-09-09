"use client";

import { useActionState } from "react";
import { createTransferAction, type ActionState } from "@/features/banks/actions";

const initialState: ActionState = { error: null };
const today = new Date().toISOString().slice(0, 10);

type Account = { id: string; name: string; bank_name: string | null; currency: string };

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
      <div>
        <label className="block text-xs text-brand-muted">Cuenta destino</label>
        <select
          name="to_bank_account_id"
          required
          defaultValue=""
          className="border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        >
          <option value="" disabled>
            Selecciona…
          </option>
          {otherAccounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.currency})
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs text-brand-muted">Fecha</label>
        <input
          name="transaction_date"
          type="date"
          required
          defaultValue={today}
          className="border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        />
      </div>
      <div>
        <label className="block text-xs text-brand-muted">Monto</label>
        <input
          name="amount"
          type="number"
          step="0.01"
          min="0.01"
          required
          className="w-28 border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        />
      </div>
      <div>
        <label className="block text-xs text-brand-muted">Descripción</label>
        <input
          name="description"
          placeholder="Opcional"
          className="w-48 border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Transfiriendo…" : "Transferir"}
      </button>
      {state.error && <p className="w-full text-sm text-brand-danger">{state.error}</p>}
    </form>
  );
}
