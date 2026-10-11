"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { addInvoiceItemAction, type ActionState } from "@/features/invoices/actions";
import { Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import {
  LineItemFields,
  type LinePrefill,
  type LineService,
  type LineTaxRate,
  type LineTaxRateRef,
} from "@/components/documents/line-item-fields";

const initialState: ActionState = { error: null };

type ProjectItem = { id: string; description: string; quantity: number; unit_price: number };

export function NewInvoiceItemForm({
  invoiceId,
  services,
  projectItems,
  defaultTaxRate,
  taxRates,
  currency = "DOP",
}: {
  invoiceId: string;
  services: LineService[];
  projectItems: ProjectItem[];
  // Tasa marcada como predeterminada en Configuración → Impuestos. Si es
  // null (nada marcado como predeterminada), se usa la primera del catálogo.
  defaultTaxRate: LineTaxRateRef | null;
  taxRates: LineTaxRate[];
  currency?: string;
}) {
  const addWithId = addInvoiceItemAction.bind(null, invoiceId);
  const [state, formAction, pending] = useActionState(addWithId, initialState);
  const [prefill, setPrefill] = useState<LinePrefill | null>(null);
  // Al agregar una línea con éxito, los campos se vuelven a montar en blanco.
  const [resetKey, setResetKey] = useState(0);
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending && !state.error) {
      setPrefill(null);
      setResetKey((k) => k + 1);
    }
    wasPending.current = pending;
  }, [pending, state.error]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {projectItems.length > 0 && (
        <Select
          label="Copiar una línea del proyecto (opcional)"
          value=""
          onChange={(e) => {
            const item = projectItems.find((p) => p.id === e.target.value);
            if (item) setPrefill({ description: item.description, unit_price: item.unit_price, quantity: item.quantity });
          }}
          className="sm:max-w-md"
        >
          <option value="">— Elegir línea del proyecto —</option>
          {projectItems.map((p) => (
            <option key={p.id} value={p.id}>
              {p.description}
            </option>
          ))}
        </Select>
      )}
      <LineItemFields
        key={resetKey}
        services={services}
        taxRates={taxRates}
        defaultTaxRate={defaultTaxRate}
        currency={currency}
        prefill={prefill}
      />
      <div className="flex flex-col gap-2 border-t border-brand-border pt-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-brand-danger">{state.error}</p>
        <Button type="submit" loading={pending} icon={<Plus size={14} />}>
          Agregar línea
        </Button>
      </div>
    </form>
  );
}
