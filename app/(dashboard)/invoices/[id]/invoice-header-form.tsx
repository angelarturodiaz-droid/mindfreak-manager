"use client";

import { useActionState } from "react";
import { updateInvoiceHeaderAction, type ActionState } from "@/features/invoices/actions";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

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
      <Input label="Vencimiento" name="due_date" type="date" defaultValue={invoice.due_date ?? ""} />
      <Input label="NCF" name="ncf" defaultValue={invoice.ncf ?? ""} />
      <Input label="Tipo NCF" name="ncf_type" defaultValue={invoice.ncf_type ?? ""} />
      <Button type="submit" variant="outline" loading={pending}>
        Guardar
      </Button>
      {state.error && <p className="w-full text-sm text-brand-danger">{state.error}</p>}
    </form>
  );
}
