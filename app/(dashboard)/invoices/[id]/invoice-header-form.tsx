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
    issue_date: string;
    due_date: string | null;
    payment_terms_id: string | null;
    ncf: string | null;
    ncf_type: string | null;
  };
  paymentTerms: { id: string; name: string; credit_days: number }[];
}) {
  const updateWithId = updateInvoiceHeaderAction.bind(null, invoice.id);
  const [state, formAction, pending] = useActionState(updateWithId, initialState);
  const [paymentTermsId, setPaymentTermsId] = useState(invoice.payment_terms_id ?? "");
  const [manualDueDate, setManualDueDate] = useState(invoice.due_date ?? "");

  const selectedTerm = paymentTerms.find((t) => t.id === paymentTermsId);
  const previewDueDate = (() => {
    if (!selectedTerm) return "";
    const d = new Date(`${invoice.issue_date}T00:00:00`);
    d.setDate(d.getDate() + selectedTerm.credit_days);
    return d.toISOString().slice(0, 10);
  })();
  const dueDateValue = paymentTermsId ? previewDueDate : manualDueDate;

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
        value={dueDateValue}
        onChange={(e) => setManualDueDate(e.target.value)}
        disabled={!!paymentTermsId}
        hint={
          paymentTermsId
            ? `Se calcula sola: ${invoice.issue_date} + ${selectedTerm?.credit_days ?? 0} días`
            : undefined
        }
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
