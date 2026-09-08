"use client";

import { useActionState, useState } from "react";
import { addQuotationItemAction, type ActionState } from "@/features/quotations/actions";

const initialState: ActionState = { error: null };

type Service = {
  id: string;
  name: string;
  unit: string | null;
  default_price: number;
  default_cost: number;
};

export function NewItemForm({
  quotationId,
  services,
}: {
  quotationId: string;
  services: Service[];
}) {
  const addWithId = addQuotationItemAction.bind(null, quotationId);
  const [state, formAction, pending] = useActionState(addWithId, initialState);
  const [selectedService, setSelectedService] = useState<Service | null>(null);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <div>
        <label className="block text-xs text-brand-muted">Servicio</label>
        <select
          name="service_id"
          defaultValue=""
          onChange={(e) => {
            const svc = services.find((s) => s.id === e.target.value) ?? null;
            setSelectedService(svc);
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
          defaultValue={selectedService?.name ?? ""}
          key={selectedService?.id ?? "custom"}
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
          defaultValue="1"
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
          defaultValue={selectedService?.default_price ?? 0}
          key={`price-${selectedService?.id ?? "custom"}`}
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
        <label className="block text-xs text-brand-muted">Impuesto</label>
        <input
          name="tax"
          type="number"
          step="0.01"
          min="0"
          defaultValue="0"
          className="w-24 border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        />
      </div>
      <div>
        <label className="block text-xs text-brand-muted">Costo unit. est.</label>
        <input
          name="estimated_unit_cost"
          type="number"
          step="0.01"
          min="0"
          defaultValue={selectedService?.default_cost ?? 0}
          key={`cost-${selectedService?.id ?? "custom"}`}
          className="w-28 border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
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
