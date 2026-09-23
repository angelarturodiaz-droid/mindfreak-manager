"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { createInvoiceAction, type ActionState } from "@/features/invoices/actions";
import { Input, Select } from "@/components/ui/field";
import { CurrencyExchangeFields } from "@/components/ui/currency-exchange-fields";
import { Button } from "@/components/ui/button";

const initialState: ActionState = { error: null };
const today = new Date().toISOString().slice(0, 10);

type Client = { id: string; name: string };
type Project = {
  id: string;
  number: string;
  name: string;
  client_id: string;
  clients: { name: string }[] | { name: string } | null;
};
type TaxRate = { id: string; name: string; rate: number; is_default: boolean };

export function NewInvoiceForm({
  clients,
  projects,
  baseCurrency,
  paymentTerms,
  taxRates,
}: {
  clients: Client[];
  projects: Project[];
  baseCurrency: string;
  paymentTerms: { id: string; name: string; credit_days: number }[];
  taxRates: TaxRate[];
}) {
  const [state, formAction, pending] = useActionState(
    createInvoiceAction,
    initialState,
  );
  const [useProject, setUseProject] = useState(false);
  const [paymentTermsId, setPaymentTermsId] = useState("");
  const [issueDate, setIssueDate] = useState(today);
  const [manualDueDate, setManualDueDate] = useState("");
  const [billingType, setBillingType] = useState("REGULAR");

  const selectedTerm = paymentTerms.find((t) => t.id === paymentTermsId);
  const previewDueDate = (() => {
    if (!selectedTerm || !issueDate) return "";
    const d = new Date(`${issueDate}T00:00:00`);
    d.setDate(d.getDate() + selectedTerm.credit_days);
    return d.toISOString().slice(0, 10);
  })();
  const dueDateValue = paymentTermsId ? previewDueDate : manualDueDate;

  return (
    <form action={formAction} className="max-w-md space-y-4">
      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-1">
          <input
            type="radio"
            checked={!useProject}
            onChange={() => setUseProject(false)}
          />
          Cliente directo
        </label>
        <label className="flex items-center gap-1">
          <input
            type="radio"
            checked={useProject}
            onChange={() => setUseProject(true)}
          />
          Desde un proyecto
        </label>
      </div>

      {!useProject ? (
        <Select label="Cliente" name="client_id" required={!useProject} defaultValue="">
          <option value="" disabled>
            Selecciona un cliente…
          </option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      ) : (
        <Select label="Proyecto" name="project_id" required={useProject} defaultValue="">
          <option value="" disabled>
            Selecciona un proyecto…
          </option>
          {projects.map((p) => {
            const clientData = Array.isArray(p.clients) ? p.clients[0] : p.clients;
            return (
              <option key={p.id} value={p.id}>
                {p.number} — {p.name} ({clientData?.name ?? "—"})
              </option>
            );
          })}
        </Select>
      )}

      <Input
        label="Fecha de emisión"
        name="issue_date"
        type="date"
        required
        defaultValue={today}
        onChange={(e) => setIssueDate(e.target.value)}
      />

      <Select
        label="Condición de pago"
        name="payment_terms_id"
        defaultValue=""
        onChange={(e) => setPaymentTermsId(e.target.value)}
        hint={
          useProject
            ? "Si el proyecto viene de una cotización con condición de pago, se hereda automáticamente si dejas esto en blanco."
            : undefined
        }
      >
        <option value="">Sin especificar</option>
        {paymentTerms.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </Select>

      <Input
        label="Fecha de vencimiento"
        name="due_date"
        type="date"
        disabled={!!paymentTermsId}
        value={dueDateValue}
        onChange={(e) => setManualDueDate(e.target.value)}
        hint={
          paymentTermsId
            ? `Se calcula sola: ${issueDate || "—"} + ${selectedTerm?.credit_days ?? 0} días`
            : undefined
        }
      />

      <Input
        label="Comisión de la empresa (%)"
        name="commission_percent"
        type="number"
        step="0.01"
        min="0"
        max="100"
        defaultValue="0"
        hint="Se suma antes del descuento y del ITBIS."
      />
      <Select
        label="Tratamiento fiscal de la comisión"
        name="commission_tax_rate_id"
        defaultValue={taxRates.find((r) => r.is_default)?.id ?? taxRates[0]?.id ?? ""}
        hint="Solo aplica si hay comisión. No hereda el tratamiento de las líneas."
      >
        {taxRates.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name} ({r.rate}%)
          </option>
        ))}
      </Select>

      <CurrencyExchangeFields baseCurrency={baseCurrency} />

      <Select
        label="Tipo de facturación"
        name="billing_type"
        defaultValue="REGULAR"
        onChange={(e) => setBillingType(e.target.value)}
      >
        <option value="REGULAR">Tradicional (NCF)</option>
        <option value="ELECTRONIC">Electrónica (e-CF)</option>
      </Select>

      {billingType === "ELECTRONIC" && (
        <div className="space-y-4 rounded-[var(--radius-md)] border border-brand-border bg-brand-background p-3">
          <p className="text-xs text-brand-muted">
            Estos datos los emite la DGII (o un proveedor certificado) al
            certificarte para e-CF — mientras tanto se pueden dejar en
            blanco o llenar a mano si ya los tienes de otra forma.
          </p>
          <Input label="e-NCF" name="e_ncf" placeholder="Ej. E310000000371" />
          <Input label="e-NCF válido hasta" name="e_ncf_valid_until" type="date" />
          <Select label="Tipo de pago" name="payment_type_code" defaultValue="">
            <option value="">Sin especificar</option>
            <option value="1">1 - Contado</option>
            <option value="2">2 - Crédito</option>
          </Select>
        </div>
      )}

      <p className="text-xs text-brand-muted">
        NCF/ITBIS: campos preparados, no activos en producción todavía (F0,
        sección R). Se pueden completar después en el detalle.
      </p>

      {state.error && <p className="text-sm text-brand-danger">{state.error}</p>}

      <div className="flex gap-3">
        <Button type="submit" loading={pending}>
          Crear factura
        </Button>
        <Link href="/invoices">
          <Button type="button" variant="ghost">
            Cancelar
          </Button>
        </Link>
      </div>
    </form>
  );
}
