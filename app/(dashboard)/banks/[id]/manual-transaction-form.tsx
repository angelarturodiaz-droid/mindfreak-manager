"use client";

import { useActionState } from "react";
import { createManualTransactionAction, type ActionState } from "@/features/banks/actions";

const initialState: ActionState = { error: null };
const today = new Date().toISOString().slice(0, 10);

export function ManualTransactionForm({ bankAccountId }: { bankAccountId: string }) {
  const createWithId = createManualTransactionAction.bind(null, bankAccountId);
  const [state, formAction, pending] = useActionState(createWithId, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <div>
        <label className="block text-xs text-brand-muted">Tipo</label>
        <select
          name="type"
          defaultValue="INCOME"
          className="border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        >
          <option value="INCOME">Ingreso</option>
          <option value="EXPENSE">Gasto</option>
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
          required
          placeholder="Ej. Interés bancario, comisión..."
          className="w-56 border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Guardando…" : "Agregar movimiento"}
      </button>
      {state.error && <p className="w-full text-sm text-brand-danger">{state.error}</p>}
    </form>
  );
}
