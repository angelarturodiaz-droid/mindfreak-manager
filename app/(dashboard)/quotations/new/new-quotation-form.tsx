"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createQuotationAction, type ActionState } from "@/features/quotations/actions";
import { Input, Select, Textarea } from "@/components/ui/field";
import { CurrencyExchangeFields } from "@/components/ui/currency-exchange-fields";
import { Button } from "@/components/ui/button";

const initialState: ActionState = { error: null };
const today = new Date().toISOString().slice(0, 10);

type TaxRate = { id: string; name: string; rate: number; is_default: boolean };

export function NewQuotationForm({
  clients,
  baseCurrency,
  paymentTerms,
  taxRates,
  defaultClientId,
}: {
  clients: { id: string; name: string; stage: string }[];
  /** Cliente preseleccionado (ej. al venir desde el detalle del cliente). */
  defaultClientId?: string;
  baseCurrency: string;
  paymentTerms: { id: string; name: string; credit_days: number }[];
  taxRates: TaxRate[];
}) {
  const [state, formAction, pending] = useActionState(
    createQuotationAction,
    initialState,
  );

  return (
    <form action={formAction} className="max-w-md space-y-4">
      <Select label="Cliente" name="client_id" required defaultValue={defaultClientId ?? ""}>
        <option value="" disabled>
          Selecciona un cliente…
        </option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} {c.stage === "LEAD" ? "(lead)" : c.stage === "PROSPECT" ? "(prospecto)" : ""}
          </option>
        ))}
      </Select>

      <Input label="Fecha de emisión" name="issue_date" type="date" required defaultValue={today} />
      <Input label="Válida hasta" name="valid_until" type="date" />

      <Select
        label="Condición de pago"
        name="payment_terms_id"
        defaultValue=""
        hint="Al aceptarse, pasa automáticamente a la factura."
      >
        <option value="">Sin especificar</option>
        {paymentTerms.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </Select>

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

      <Textarea label="Condiciones / Notas" name="terms" rows={3} />

      {state.error && <p className="text-sm text-brand-danger">{state.error}</p>}

      <div className="flex gap-3">
        <Button type="submit" loading={pending}>
          Crear cotización
        </Button>
        <Link href="/quotations">
          <Button type="button" variant="ghost">
            Cancelar
          </Button>
        </Link>
      </div>
      <p className="text-xs text-brand-muted">
        Después de crearla, agregas las líneas de servicio en la pantalla de
        detalle.
      </p>
    </form>
  );
}
