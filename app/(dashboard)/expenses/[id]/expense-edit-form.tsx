"use client";

import { useActionState } from "react";
import { updateExpenseAction, type ActionState } from "@/features/expenses/actions";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@/features/payments/schema";

const initialState: ActionState = { error: null };

type Option = { id: string; name: string };
type ProjectOption = { id: string; number: string; name: string };

export function ExpenseEditForm({
  expense,
  categories,
  suppliers,
  projects,
}: {
  expense: {
    id: string;
    category_id: string | null;
    supplier_id: string | null;
    project_id: string | null;
    expense_date: string;
    description: string;
    subtotal: number;
    tax: number;
    payment_method: string | null;
    currency: string;
    exchange_rate: number;
  };
  categories: Option[];
  suppliers: Option[];
  projects: ProjectOption[];
}) {
  const updateWithId = updateExpenseAction.bind(null, expense.id);
  const [state, formAction, pending] = useActionState(updateWithId, initialState);
  const impliedPercent =
    expense.subtotal > 0 ? Math.round((expense.tax / expense.subtotal) * 10000) / 100 : 0;

  return (
    <form action={formAction} className="max-w-md space-y-4">
      <div>
        <label className="block text-sm font-medium text-brand-text">
          Descripción *
        </label>
        <input
          name="description"
          required
          defaultValue={expense.description}
          className="mt-1 w-full border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-brand-text">Fecha *</label>
        <input
          name="expense_date"
          type="date"
          required
          defaultValue={expense.expense_date}
          className="mt-1 w-full border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-brand-text">Categoría</label>
        <select
          name="category_id"
          defaultValue={expense.category_id ?? ""}
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
          defaultValue={expense.supplier_id ?? ""}
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
          defaultValue={expense.project_id ?? ""}
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
            defaultValue={expense.subtotal}
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
            defaultValue={impliedPercent}
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
          defaultValue={expense.payment_method ?? ""}
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
            defaultValue={expense.currency}
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
            defaultValue={expense.exchange_rate}
            className="mt-1 w-full border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
          />
        </div>
      </div>

      {state.error && <p className="text-sm text-brand-danger">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Guardando…" : "Guardar cambios"}
      </button>
    </form>
  );
}
