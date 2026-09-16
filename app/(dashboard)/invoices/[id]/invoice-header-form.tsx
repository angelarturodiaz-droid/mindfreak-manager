"use client";

import { useActionState, useState } from "react";
import { updateInvoiceHeaderAction, type ActionState } from "@/features/invoices/actions";
import { Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

const initialState: ActionState = { error: null };

export function InvoiceHeaderForm({
  invoice,
  paymentTerms,
}: {
  invoice: {
    id: string;
    due_date: string | null;
    payment_terms_id: string | null;
    ncf: string | null;
    ncf_type: string | null;
  };
  paymentTerms: { id: string; name: string }[];
}) {
  const updateWithId = updateInvoiceHeaderAction.bind(null, invoice.id);
  const [state, formAction, pending] = useActionState(updateWithId, initialState);
  const [paymentTermsId, setPaymentTermsId] = useState(invoice.payment_terms_id ?? "");

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <Select
        label="Condición de pago"
        name="payment_terms_id"
        defaultValue={invoice.payment_terms_id ?? ""}
        onChange={(e) => setPaymentTermsId(e.target.value)}
        className="w-48"
      >
        <option value="">Sin especificar</option>
        {paymentTerms.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </Select>
      <Input
        label="Vencimiento"
        name="due_date"
        type="date"
        defaultValue={invoice.due_date ?? ""}
        disabled={!!paymentTermsId}
        hint={paymentTermsId ? "Se calcula solo" : undefined}
      />
      <Input label="NCF" name="ncf" defaultValue={invoice.ncf ?? ""} />
      <Input label="Tipo NCF" name="ncf_type" defaultValue={invoice.ncf_type ?? ""} />
      <Button type="submit" variant="outline" loading={pending}>
        Guardar
      </Button>
      {state.error && <p className="w-full text-sm text-brand-danger">{state.error}</p>}
    </form>
  );
}
