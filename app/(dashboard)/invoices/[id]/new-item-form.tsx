"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { addInvoiceItemAction, type ActionState } from "@/features/invoices/actions";
import { Input, Select } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { Button } from "@/components/ui/button";

const initialState: ActionState = { error: null };

type TaxRateRef = { id: string; name: string; rate: number; treatment: string };
type Service = {
  id: string;
  name: string;
  unit: string | null;
  default_price: number;
  default_tax_rate_id: string | null;
  tax_rates: TaxRateRef | TaxRateRef[] | null;
};
type ProjectItem = { id: string; description: string; quantity: number; unit_price: number };
type TaxRate = { id: string; name: string; rate: number; is_default: boolean };

function serviceTaxRateId(service: Service | null): string | null {
  if (!service) return null;
  const rate = Array.isArray(service.tax_rates) ? service.tax_rates[0] : service.tax_rates;
  return rate?.id ?? service.default_tax_rate_id ?? null;
}

export function NewInvoiceItemForm({
  invoiceId,
  services,
  projectItems,
  defaultTaxRate,
  taxRates,
}: {
  invoiceId: string;
  services: Service[];
  projectItems: ProjectItem[];
  // Tasa marcada como predeterminada en Configuración → Impuestos. Si es
  // null (nada marcado como predeterminada), se usa la primera del catálogo.
  defaultTaxRate: TaxRateRef | null;
  taxRates: TaxRate[];
}) {
  const addWithId = addInvoiceItemAction.bind(null, invoiceId);
  const [state, formAction, pending] = useActionState(addWithId, initialState);
  const [prefill, setPrefill] = useState<{
    description: string;
    unit_price: number;
    quantity: number;
  } | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  // Al agregar una línea con éxito, se reinicia todo el formulario —
  // incluyendo el tratamiento fiscal. Un form.reset() nativo por sí solo NO
  // vuelve a aplicar el defaultValue de React si el `key` del campo no
  // cambia (defaultValue solo se usa al montar) — por eso resetKey se
  // suma a cada key, forzando un remount real con el valor por defecto
  // correcto (el del servicio, o si no tiene, el de Configuración →
  // Impuestos) en cada línea nueva.
  useEffect(() => {
    if (wasPending.current && !pending && !state.error) {
      formRef.current?.reset();
      setPrefill(null);
      setSelectedService(null);
      setResetKey((k) => k + 1);
    }
    wasPending.current = pending;
  }, [pending, state.error]);

  // Tratamiento fiscal por defecto para la línea actual: el del servicio
  // elegido (Settings → Servicios) si tiene uno configurado; si no, el
  // predeterminado de Configuración → Impuestos; si tampoco hay ninguno
  // marcado como predeterminado, la primera tasa activa del catálogo.
  const defaultTaxRateId =
    serviceTaxRateId(selectedService) ?? defaultTaxRate?.id ?? taxRates[0]?.id ?? "";

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-2">
      {projectItems.length > 0 && (
        <Select
          label="Copiar del proyecto"
          defaultValue=""
          onChange={(e) => {
            const item = projectItems.find((p) => p.id === e.target.value);
            if (item) {
              setPrefill({
                description: item.description,
                unit_price: item.unit_price,
                quantity: item.quantity,
              });
            }
          }}
          className="w-56"
        >
          <option value="">— Elegir línea del proyecto —</option>
          {projectItems.map((p) => (
            <option key={p.id} value={p.id}>
              {p.description}
            </option>
          ))}
        </Select>
      )}
      <Select
        label="Servicio"
        name="service_id"
        defaultValue=""
        onChange={(e) => {
          const svc = services.find((s) => s.id === e.target.value) ?? null;
          setSelectedService(svc);
          if (svc) setPrefill({ description: svc.name, unit_price: svc.default_price, quantity: 1 });
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
        defaultValue={prefill?.description ?? ""}
        key={`desc-${prefill?.description ?? "empty"}`}
        className="w-48"
      />
      <Input
        label="Cant."
        name="quantity"
        type="number"
        step="0.01"
        min="0.01"
        defaultValue={prefill?.quantity ?? 1}
        key={`qty-${prefill?.description ?? "empty"}`}
        className="w-20"
      />
      <MoneyInput
        label="Precio"
        name="unit_price"
        defaultValue={prefill?.unit_price ?? 0}
        key={`price-${prefill?.description ?? "empty"}`}
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
        label="Tratamiento fiscal"
        name="tax_rate_id"
        required
        defaultValue={defaultTaxRateId}
        key={`tax-${selectedService?.id ?? "custom"}-${resetKey}`}
        className="w-44"
      >
        {/* Únicamente el catálogo de Configuración → Impuestos — nunca un %
            suelto (Gravado/Exento/No sujeto se resuelven ahí). */}
        {taxRates.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name} ({r.rate}%)
          </option>
        ))}
      </Select>
      <Button type="submit" loading={pending} icon={<Plus size={14} />}>
        Agregar línea
      </Button>
      {state.error && <p className="w-full text-sm text-brand-danger">{state.error}</p>}
    </form>
  );
}
