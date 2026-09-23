"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { addQuotationItemAction, type ActionState } from "@/features/quotations/actions";
import { Input, Select } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { Button } from "@/components/ui/button";

const initialState: ActionState = { error: null };

type Service = {
  id: string;
  name: string;
  unit: string | null;
  default_price: number;
  default_cost: number;
  default_tax_percent: number;
};
type TaxRate = { id: string; name: string; rate: number; is_default: boolean };

export function NewItemForm({
  quotationId,
  services,
  defaultTaxPercent,
  taxRates,
}: {
  quotationId: string;
  services: Service[];
  defaultTaxPercent: number;
  taxRates: TaxRate[];
}) {
  const addWithId = addQuotationItemAction.bind(null, quotationId);
  const [state, formAction, pending] = useActionState(addWithId, initialState);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  // Al agregar una línea con éxito, se reinicia el formulario — un
  // form.reset() nativo NO vuelve a aplicar el defaultValue de React si el
  // `key` del campo no cambia (solo se usa al montar) — por eso resetKey
  // se suma a cada key, forzando un remount real con el Impuesto (%) por
  // defecto correcto (el de Configuración → Impuestos) en cada línea nueva.
  useEffect(() => {
    if (wasPending.current && !pending && !state.error) {
      formRef.current?.reset();
      setSelectedService(null);
      setResetKey((k) => k + 1);
    }
    wasPending.current = pending;
  }, [pending, state.error]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-2">
      <Select
        label="Servicio"
        name="service_id"
        defaultValue=""
        onChange={(e) => {
          const svc = services.find((s) => s.id === e.target.value) ?? null;
          setSelectedService(svc);
        }}
        className="w-44"
      >
        <option value="">Servicio personalizado</option>
        {services.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </Select>
      <Input
        label="Descripción"
        name="description"
        required
        defaultValue={selectedService?.name ?? ""}
        key={selectedService?.id ?? "custom"}
        className="w-48"
      />
      <Input label="Cant." name="quantity" type="number" step="0.01" min="0.01" defaultValue="1" className="w-20" />
      <MoneyInput
        label="Precio"
        name="unit_price"
        defaultValue={selectedService?.default_price ?? 0}
        key={`price-${selectedService?.id ?? "custom"}`}
        className="w-28"
      />
      <Input
        label="Descuento (%)"
        name="discount_percent"
        type="number"
        step="0.01"
        min="0"
        max="100"
        defaultValue={0}
        className="w-24"
      />
      <Select
        label="Impuesto"
        name="tax_percent"
        defaultValue={String(selectedService?.default_tax_percent ?? defaultTaxPercent)}
        key={`tax-${selectedService?.id ?? "custom"}-${resetKey}`}
        className="w-32"
      >
        {/* Catálogo de Configuración → Impuestos (incluye tasas en 0%, ej. "Exento"). Si el
            valor por defecto (del servicio o el predeterminado) no está en el catálogo, se
            agrega como opción suelta para no perder el valor. */}
        {!taxRates.some((r) => r.rate === (selectedService?.default_tax_percent ?? defaultTaxPercent)) && (
          <option value={selectedService?.default_tax_percent ?? defaultTaxPercent}>
            {(selectedService?.default_tax_percent ?? defaultTaxPercent)}% (personalizado)
          </option>
        )}
        {taxRates.map((r) => (
          <option key={r.id} value={r.rate}>
            {r.name} ({r.rate}%)
          </option>
        ))}
      </Select>
      <MoneyInput
        label="Costo unit. est."
        name="estimated_unit_cost"
        defaultValue={selectedService?.default_cost ?? 0}
        key={`cost-${selectedService?.id ?? "custom"}`}
        className="w-28"
      />
      <Button type="submit" loading={pending} icon={<Plus size={14} />}>
        Agregar línea
      </Button>
      {state.error && <p className="w-full text-sm text-brand-danger">{state.error}</p>}
    </form>
  );
}
