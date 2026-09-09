"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createBankAccountAction, type ActionState } from "@/features/banks/actions";

const initialState: ActionState = { error: null };
const today = new Date().toISOString().slice(0, 10);

export function NewBankAccountForm() {
  const [state, formAction, pending] = useActionState(createBankAccountAction, initialState);

  return (
    <form action={formAction} className="max-w-md space-y-4">
      <div>
        <label className="block text-sm font-medium text-brand-text">Nombre *</label>
        <input
          name="name"
          required
          placeholder="Ej. Cuenta Corriente Banreservas"
          className="mt-1 w-full border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-brand-text">Banco</label>
        <input
          name="bank_name"
          className="mt-1 w-full border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-brand-text">
          Número de cuenta (enmascarado)
        </label>
        <input
          name="account_number_masked"
          placeholder="****1234"
          className="mt-1 w-full border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        />
        <p className="mt-1 text-xs text-brand-muted">
          Nunca se guardan credenciales bancarias, solo un número de
          referencia enmascarado.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-brand-text">Moneda</label>
          <select
            name="currency"
            defaultValue="DOP"
            className="mt-1 w-full border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
          >
            <option value="DOP">DOP</option>
            <option value="USD">USD</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-brand-text">
            Balance inicial
          </label>
          <input
            name="opening_balance"
            type="number"
            step="0.01"
            defaultValue="0"
            className="mt-1 w-full border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-brand-text">
          Fecha del balance inicial
        </label>
        <input
          name="opening_balance_date"
          type="date"
          required
          defaultValue={today}
          className="mt-1 w-full border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        />
      </div>

      {state.error && <p className="text-sm text-brand-danger">{state.error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Creando…" : "Crear cuenta"}
        </button>
        <Link
          href="/banks"
          className="px-4 py-2 text-sm text-brand-muted hover:text-brand-text"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
