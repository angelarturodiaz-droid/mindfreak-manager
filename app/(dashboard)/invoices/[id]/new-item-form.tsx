"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { addInvoiceItemAction, type ActionState } from "@/features/invoices/actions";
import { Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

const initialState: ActionState = { error: null };

type Service = {
  id: string;
  name: string;
  unit: string | null;
  default_price: number;
  default_tax_percent: number;
};
type ProjectItem = { id: string; description: string; quantity: number; unit_price: number };

export function NewInvoiceItemForm({
  invoiceId,
  services,
  projectItems,
}: {
  invoiceId: string;
  services: Service[];
  projectItems: ProjectItem[];
}) {
  const addWithId = addInvoiceItemAction.bind(null, invoiceId);
  const [state, formAction, pending] = useActionState(addWithId, initialState);
  const [prefill, setPrefill] = useState<{
    description: string;
    unit_price: number;
    quantity: number;
  } | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
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
      <Input
        label="Precio"
        name="unit_price"
        type="number"
        step="0.01"
        min="0"
        defaultValue={prefill?.unit_price ?? 0}
        key={`price-${prefill?.description ?? "empty"}`}
        className="w-28"
      />
      <Input label="Descuento" name="discount" type="number" step="0.01" min="0" defaultValue="0" className="w-24" />
      <Input
        label="Impuesto (%)"
        name="tax_percent"
        type="number"
        step="0.01"
        min="0"
        defaultValue={selectedService?.default_tax_percent ?? 18}
        key={`tax-${selectedService?.id ?? "custom"}`}
        className="w-20"
      />
      <Button type="submit" loading={pending} icon={<Plus size={14} />}>
        Agregar línea
      </Button>
      {state.error && <p className="w-full text-sm text-brand-danger">{state.error}</p>}
    </form>
  );
}
