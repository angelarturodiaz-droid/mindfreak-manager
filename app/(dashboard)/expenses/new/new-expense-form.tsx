"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createExpenseAction, type ActionState } from "@/features/expenses/actions";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@/features/payments/schema";

const initialState: ActionState = { error: null };
const today = new Date().toISOString().slice(0, 10);

type Option = { id: string; name: string };
type ProjectOption = { id: string; number: string; name: string };

export function NewExpenseForm({
  categories,
  suppliers,
  projects,
}: {
  categories: Option[];
  suppliers: Option[];
  projects: ProjectOption[];
}) {
  const [state, formAction, pending] = useActionState(createExpenseAction, initialState);

  return (
    <form action={formAction} className="max-w-md space-y-4">
      <div>
        <label className="block text-sm font-medium text-brand-text">
          Descripción *
        </label>
        <input
          name="description"
          required
          className="mt-1 w-full border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-brand-text">Fecha *</label>
        <input
          name="expense_date"
          type="date"
          required
          defaultValue={today}
          className="mt-1 w-full border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-brand-text">Categoría</label>
        <select
          name="category_id"
          defaultValue=""
          className="mt-1 w-full border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        >
          <option value="">Sin categoría</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-brand-text">Proveedor</label>
        <select
          name="supplier_id"
          defaultValue=""
          className="mt-1 w-full border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        >
          <option value="">Sin proveedor (gasto general)</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-brand-text">
          Proyecto/Evento
        </label>
        <select
          name="project_id"
          defaultValue=""
          className="mt-1 w-full border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        >
          <option value="">Sin proyecto (gasto general de la empresa)</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.number} — {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-brand-text">
            Subtotal *
          </label>
          <input
            name="subtotal"
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue="0"
            className="mt-1 w-full border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-brand-text">
            Impuesto (%)
          </label>
          <input
            name="tax_percent"
            type="number"
            step="0.01"
            min="0"
            defaultValue="18"
            className="mt-1 w-full border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-brand-text">
          Método de pago
        </label>
        <select
          name="payment_method"
          defaultValue=""
          className="mt-1 w-full border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        >
          <option value="">Sin especificar</option>
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {PAYMENT_METHOD_LABELS[m]}
            </option>
          ))}
        </select>
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
            Tasa de cambio
          </label>
          <input
            name="exchange_rate"
            type="number"
            step="0.000001"
            min="0.000001"
            defaultValue="1"
            className="mt-1 w-full border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
          />
        </div>
      </div>

      {state.error && <p className="text-sm text-brand-danger">{state.error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Creando…" : "Crear gasto"}
        </button>
        <Link
          href="/expenses"
          className="px-4 py-2 text-sm text-brand-muted hover:text-brand-text"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
