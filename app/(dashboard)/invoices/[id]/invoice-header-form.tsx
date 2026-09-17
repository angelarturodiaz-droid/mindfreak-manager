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
    billing_type: string;
    ncf: string | null;
    ncf_type: string | null;
    e_ncf: string | null;
    e_ncf_valid_until: string | null;
    payment_type_code: string | null;
  };
  paymentTerms: { id: string; name: string; credit_days: number }[];
}) {
  const updateWithId = updateInvoiceHeaderAction.bind(null, invoice.id);
  const [state, formAction, pending] = useActionState(updateWithId, initialState);
  const [paymentTermsId, setPaymentTermsId] = useState(invoice.payment_terms_id ?? "");
  const [manualDueDate, setManualDueDate] = useState(invoice.due_date ?? "");
  const [billingType, setBillingType] = useState(invoice.billing_type);

  const selectedTerm = paymentTerms.find((t) => t.id === paymentTermsId);
  const previewDueDate = (() => {
    if (!selectedTerm) return "";
    const d = new Date(`${invoice.issue_date}T00:00:00`);
    d.setDate(d.getDate() + selectedTerm.credit_days);
    return d.toISOString().slice(0, 10);
  })();
  const dueDateValue = paymentTermsId ? previewDueDate : manualDueDate;

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
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
        <Select
          label="Tipo de facturación"
          name="billing_type"
          defaultValue={invoice.billing_type}
          onChange={(e) => setBillingType(e.target.value)}
          className="w-44"
        >
          <option value="REGULAR">Tradicional (NCF)</option>
          <option value="ELECTRONIC">Electrónica (e-CF)</option>
        </Select>
      </div>

      {billingType === "ELECTRONIC" ? (
        <div className="flex flex-wrap items-end gap-2 rounded-[var(--radius-md)] border border-brand-border bg-brand-background p-3">
          <Input label="e-NCF" name="e_ncf" defaultValue={invoice.e_ncf ?? ""} placeholder="Pendiente de certificación DGII" />
          <Input
            label="e-NCF válido hasta"
            name="e_ncf_valid_until"
            type="date"
            defaultValue={invoice.e_ncf_valid_until ?? ""}
          />
          <Select label="Tipo de pago" name="payment_type_code" defaultValue={invoice.payment_type_code ?? ""}>
            <option value="">Sin especificar</option>
            <option value="1">1 - Contado</option>
            <option value="2">2 - Crédito</option>
          </Select>
        </div>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <Input label="NCF" name="ncf" defaultValue={invoice.ncf ?? ""} />
          <Input label="Tipo NCF" name="ncf_type" defaultValue={invoice.ncf_type ?? ""} />
        </div>
      )}

      <div>
        <Button type="submit" variant="outline" loading={pending}>
          Guardar
        </Button>
        {state.error && <p className="mt-1 text-sm text-brand-danger">{state.error}</p>}
      </div>
    </form>
  );
}
