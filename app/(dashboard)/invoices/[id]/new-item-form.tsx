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
import { EcfLineFields } from "@/components/invoices/ecf-line-fields";
import { DEFAULT_UNIT_CODE } from "@/lib/dgii/catalogs";

const initialState: ActionState = { error: null };

type ProjectItem = { id: string; description: string; quantity: number; unit_price: number };

export function NewInvoiceItemForm({
  invoiceId,
  services,
  projectItems,
  defaultTaxRate,
  taxRates,
  currency = "DOP",
  electronic = false,
}: {
  invoiceId: string;
  services: LineService[];
  projectItems: ProjectItem[];
  // Tasa marcada como predeterminada en Configuración → Impuestos. Si es
  // null (nada marcado como predeterminada), se usa la primera del catálogo.
  defaultTaxRate: LineTaxRateRef | null;
  taxRates: LineTaxRate[];
  currency?: string;
  /** Factura electrónica: pide también unidad y bien/servicio. */
  electronic?: boolean;
}) {
  const addWithId = addInvoiceItemAction.bind(null, invoiceId);
  const [state, formAction, pending] = useActionState(addWithId, initialState);
  const [prefill, setPrefill] = useState<LinePrefill | null>(null);
  // 5b: unidad y bien/servicio (factura electrónica). Se llenan solos con la ficha del producto o servicio elegido.
  const [unit, setUnit] = useState(DEFAULT_UNIT_CODE);
  const [kind, setKind] = useState("SERVICIO");
  const [fromCatalog, setFromCatalog] = useState<string | null>(null);
  function onServiceChange(svc: LineService | null) {
    setFromCatalog(svc?.name ?? null);
    setUnit(svc?.unit_code || DEFAULT_UNIT_CODE);
    setKind(svc?.type === "PRODUCTO" ? "BIEN" : "SERVICIO");
  }
  // Al agregar una línea con éxito, los campos se vuelven a montar en blanco.
  const [resetKey, setResetKey] = useState(0);
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending && !state.error) {
      setPrefill(null);
      setResetKey((k) => k + 1);
      setUnit(DEFAULT_UNIT_CODE);
      setKind("SERVICIO");
      setFromCatalog(null);
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
        onServiceChange={electronic ? onServiceChange : undefined}
      />
      {electronic && <EcfLineFields unit={unit} kind={kind} onUnit={setUnit} onKind={setKind} fromCatalog={fromCatalog} />}
      <div className="flex flex-col gap-2 border-t border-brand-border pt-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-brand-danger">{state.error}</p>
        <Button type="submit" loading={pending} icon={<Plus size={14} />}>
          Agregar línea
        </Button>
      </div>
    </form>
  );
}
