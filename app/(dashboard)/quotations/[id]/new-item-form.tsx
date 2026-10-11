"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { addQuotationItemAction, type ActionState } from "@/features/quotations/actions";
import { Button } from "@/components/ui/button";
import {
  LineItemFields,
  type LineService,
  type LineTaxRate,
  type LineTaxRateRef,
} from "@/components/documents/line-item-fields";

const initialState: ActionState = { error: null };

export function NewItemForm({
  quotationId,
  services,
  defaultTaxRate,
  taxRates,
  currency = "DOP",
}: {
  quotationId: string;
  services: LineService[];
  // Tasa marcada como predeterminada en Configuración → Impuestos. Si es
  // null, se usa la primera del catálogo.
  defaultTaxRate: LineTaxRateRef | null;
  taxRates: LineTaxRate[];
  currency?: string;
}) {
  const addWithId = addQuotationItemAction.bind(null, quotationId);
  const [state, formAction, pending] = useActionState(addWithId, initialState);
  // Al agregar una línea con éxito, los campos se vuelven a montar en blanco.
  const [resetKey, setResetKey] = useState(0);
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending && !state.error) setResetKey((k) => k + 1);
    wasPending.current = pending;
  }, [pending, state.error]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <LineItemFields
        key={resetKey}
        services={services}
        taxRates={taxRates}
        defaultTaxRate={defaultTaxRate}
        currency={currency}
        showCost
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
