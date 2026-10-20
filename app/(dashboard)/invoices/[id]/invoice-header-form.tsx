"use client";

import { useActionState, useState } from "react";
import { updateInvoiceHeaderAction, type ActionState } from "@/features/invoices/actions";
import { AlertTriangle, CalendarDays } from "lucide-react";
import { Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { InfoHint } from "@/components/ui/info-hint";
import { formatDate } from "@/lib/utils/dates";

const initialState: ActionState = { error: null };

export function InvoiceHeaderForm({
  invoice,
  paymentTerms,
  projectEvent,
}: {
  invoice: {
    id: string;
    issue_date: string;
    due_date: string | null;
    payment_terms_id: string | null;
    credit_days: number | null;
    billing_type: string;
    ncf: string | null;
    ncf_type: string | null;
    e_ncf: string | null;
    e_ncf_valid_until: string | null;
    payment_type_code: string | null;
  };
  paymentTerms: { id: string; name: string; credit_days: number }[];
  /** Factura de un proyecto: número y fecha del evento (para el aviso del vencimiento). */
  projectEvent?: { number: string; eventDate: string | null } | null;
}) {
  const updateWithId = updateInvoiceHeaderAction.bind(null, invoice.id);
  const [state, formAction, pending] = useActionState(updateWithId, initialState);
  const [paymentTermsId, setPaymentTermsId] = useState(invoice.payment_terms_id ?? "");
  const [manualDueDate, setManualDueDate] = useState(invoice.due_date ?? "");
  const [billingType, setBillingType] = useState(invoice.billing_type);
  // «Usar otra fecha»: condición de pago guardada pero vencimiento escrito a mano.
  const [manualDue, setManualDue] = useState(Boolean(invoice.payment_terms_id) && invoice.credit_days === null);

  const selectedTerm = paymentTerms.find((t) => t.id === paymentTermsId);
  const previewDueDate = (() => {
    if (!selectedTerm) return "";
    const d = new Date(`${invoice.issue_date}T00:00:00`);
    d.setDate(d.getDate() + selectedTerm.credit_days);
    return d.toISOString().slice(0, 10);
  })();
  const autoDue = Boolean(paymentTermsId) && !manualDue;
  const dueDateValue = autoDue ? previewDueDate : manualDueDate;
  const eventDate = projectEvent?.eventDate ?? null;
  const dueBeforeEvent = Boolean(eventDate && dueDateValue && dueDateValue < eventDate);

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
          disabled={autoDue}
          hint={
            autoDue
              ? `Se calcula sola: ${invoice.issue_date} + ${selectedTerm?.credit_days ?? 0} días`
              : paymentTermsId
                ? "Fecha escrita a mano (la condición de pago se mantiene)."
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

      {paymentTermsId && (
        <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-brand-text">
          <input
            type="checkbox"
            name="manual_due"
            checked={manualDue}
            onChange={(e) => {
              setManualDue(e.target.checked);
              if (e.target.checked && !manualDueDate) setManualDueDate(previewDueDate);
            }}
          />
          Usar otra fecha de vencimiento
          <InfoHint text="Mantiene la condición de pago (ej. 50 % anticipo / 50 % al finalizar) pero te deja escribir el vencimiento, por ejemplo unos días después del evento. Los recordatorios al cliente se cuentan desde esta fecha. Solo se puede cambiar en Borrador." />
        </label>
      )}

      {projectEvent && (
        <div
          className={`flex items-start gap-2 rounded-[var(--radius-md)] px-3 py-2 text-xs ${
            dueBeforeEvent ? "bg-brand-warning-bg text-brand-text" : "bg-brand-accent-light text-brand-text"
          }`}
        >
          {dueBeforeEvent ? (
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-brand-warning" aria-hidden />
          ) : (
            <CalendarDays size={14} className="mt-0.5 shrink-0 text-brand-accent" aria-hidden />
          )}
          <span>
            {!eventDate ? (
              <>
                El proyecto {projectEvent.number} no tiene fecha de evento. Ponla en el proyecto para comparar con el
                vencimiento.
              </>
            ) : dueBeforeEvent ? (
              <>
                El vencimiento ({formatDate(dueDateValue)}) es <strong>antes del evento</strong> ({formatDate(eventDate)}): el
                cliente recibiría recordatorios antes de que termine el proyecto. Si paga al terminar, usa una fecha
                posterior.
              </>
            ) : (
              <>
                El evento de {projectEvent.number} es el <strong>{formatDate(eventDate)}</strong>. Los recordatorios se
                cuentan desde el vencimiento: si el cliente paga al terminar, pon una fecha después del evento.
              </>
            )}
          </span>
        </div>
      )}

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
