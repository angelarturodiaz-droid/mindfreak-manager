"use client";

import { useActionState, useState } from "react";
import { addInvoiceItemAction, type ActionState } from "@/features/invoices/actions";

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
        <div>
          <label className="block text-xs text-brand-muted">
            Copiar del proyecto
          </label>
          <select
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
            className="border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
          >
            <option value="">— Elegir línea del proyecto —</option>
            {projectItems.map((p) => (
              <option key={p.id} value={p.id}>
                {p.description}
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className="block text-xs text-brand-muted">Servicio</label>
        <select
          name="service_id"
          defaultValue=""
          onChange={(e) => {
            const svc = services.find((s) => s.id === e.target.value) ?? null;
            setSelectedService(svc);
            if (svc) setPrefill({ description: svc.name, unit_price: svc.default_price, quantity: 1 });
          }}
          className="border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        >
          <option value="">Servicio personalizado</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs text-brand-muted">Descripción</label>
        <input
          name="description"
          required
          defaultValue={prefill?.description ?? ""}
          key={`desc-${prefill?.description ?? "empty"}`}
          className="border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        />
      </div>
      <div>
        <label className="block text-xs text-brand-muted">Cant.</label>
        <input
          name="quantity"
          type="number"
          step="0.01"
          min="0.01"
          defaultValue={prefill?.quantity ?? 1}
          key={`qty-${prefill?.description ?? "empty"}`}
          className="w-20 border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        />
      </div>
      <div>
        <label className="block text-xs text-brand-muted">Precio</label>
        <input
          name="unit_price"
          type="number"
          step="0.01"
          min="0"
          defaultValue={prefill?.unit_price ?? 0}
          key={`price-${prefill?.description ?? "empty"}`}
          className="w-28 border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        />
      </div>
      <div>
        <label className="block text-xs text-brand-muted">Descuento</label>
        <input
          name="discount"
          type="number"
          step="0.01"
          min="0"
          defaultValue="0"
          className="w-24 border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        />
      </div>
      <div>
        <label className="block text-xs text-brand-muted">Impuesto (%)</label>
        <input
          name="tax_percent"
          type="number"
          step="0.01"
          min="0"
          defaultValue={selectedService?.default_tax_percent ?? 18}
          key={`tax-${selectedService?.id ?? "custom"}`}
          className="w-20 border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Agregando…" : "Agregar línea"}
      </button>
      {state.error && <p className="w-full text-sm text-brand-danger">{state.error}</p>}
    </form>
  );
}
