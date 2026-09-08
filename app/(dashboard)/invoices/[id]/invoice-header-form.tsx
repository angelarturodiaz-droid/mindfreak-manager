"use client";

import { useActionState } from "react";
import { updateInvoiceHeaderAction, type ActionState } from "@/features/invoices/actions";

const initialState: ActionState = { error: null };

export function InvoiceHeaderForm({
  invoice,
}: {
  invoice: {
    id: string;
    due_date: string | null;
    ncf: string | null;
    ncf_type: string | null;
  };
}) {
  const updateWithId = updateInvoiceHeaderAction.bind(null, invoice.id);
  const [state, formAction, pending] = useActionState(updateWithId, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <div>
        <label className="block text-xs text-brand-muted">Vencimiento</label>
        <input
          name="due_date"
          type="date"
          defaultValue={invoice.due_date ?? ""}
          className="border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        />
      </div>
      <div>
        <label className="block text-xs text-brand-muted">NCF</label>
        <input
          name="ncf"
          defaultValue={invoice.ncf ?? ""}
          className="border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        />
      </div>
      <div>
        <label className="block text-xs text-brand-muted">Tipo NCF</label>
        <input
          name="ncf_type"
          defaultValue={invoice.ncf_type ?? ""}
          className="border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="border border-brand-muted/30 px-4 py-2 text-sm text-brand-text hover:border-brand-accent disabled:opacity-50"
      >
        {pending ? "Guardando…" : "Guardar"}
      </button>
      {state.error && <p className="w-full text-sm text-brand-danger">{state.error}</p>}
    </form>
  );
}
