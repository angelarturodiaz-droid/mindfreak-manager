"use client";

import { useActionState, useState } from "react";
import { UnitCodeSelect } from "@/components/invoices/unit-code-select";
import { Plus } from "lucide-react";
import { createServiceAction, type ActionState } from "@/features/services/actions";
import { SERVICE_TYPES } from "@/features/services/schema";
import { Input, Select, Textarea } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

const initialState: ActionState = { error: null };

const TYPE_LABELS: Record<string, string> = {
  PRODUCTO: "Producto",
  SERVICIO: "Servicio",
};

type TaxRate = { id: string; name: string; rate: number; treatment: string };

/** 4-nov: botón «Nuevo producto/servicio» que abre una ventana con el formulario (ya no va apretado en la columna). */
export function NewServiceButton({
  categories,
  taxRates,
}: {
  categories: { id: string; name: string }[];
  taxRates: TaxRate[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" icon={<Plus size={14} />} onClick={() => setOpen(true)} hint="Agrega un producto o servicio al catálogo que se usa en cotizaciones y facturas.">
        Nuevo producto/servicio
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Nuevo producto o servicio" size="lg">
        {/* Se vuelve a montar al abrir: el formulario empieza en blanco. */}
        {open && <NewServiceForm categories={categories} taxRates={taxRates} onCancel={() => setOpen(false)} />}
      </Modal>
    </>
  );
}

function NewServiceForm({
  categories,
  taxRates,
  onCancel,
}: {
  categories: { id: string; name: string }[];
  taxRates: TaxRate[];
  onCancel: () => void;
}) {
  const [state, formAction, pending] = useActionState(createServiceAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <p className="text-sm text-brand-muted">
        Solo el nombre es obligatorio. Estos valores se precargan al agregar la línea en una cotización o factura; ahí se pueden cambiar.
      </p>
      <Input label="Nombre" name="name" placeholder="Ej. Producción de evento, Pantalla LED" required />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Select label="Categoría" name="category_id" defaultValue="">
          <option value="">Sin categoría</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select label="Tipo" name="type" defaultValue="SERVICIO" info="Servicio: producción, coordinación, montaje, alquileres. Producto: un artículo que se vende y se entrega.">
          {SERVICE_TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
        </Select>
      </div>
      <Textarea label="Descripción (opcional)" name="description" rows={2} placeholder="Qué incluye" />
      <UnitCodeSelect />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MoneyInput label="Costo" name="default_cost" min={0} defaultValue={0} />
        <MoneyInput label="Precio de venta" name="default_price" min={0} defaultValue={0} />
        <Select label="Tratamiento fiscal" name="default_tax_rate_id" defaultValue="">
          <option value="">Usar el predeterminado</option>
          {taxRates.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} ({r.rate}%)
            </option>
          ))}
        </Select>
      </div>
      {state.error && <p className="text-sm text-brand-danger">{state.error}</p>}
      <div className="flex items-center justify-end gap-2 border-t border-brand-border pt-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" loading={pending} icon={<Plus size={14} />}>
          Agregar al catálogo
        </Button>
      </div>
    </form>
  );
}
