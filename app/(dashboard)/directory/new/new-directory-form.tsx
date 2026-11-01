"use client";

import { useActionState, useState } from "react";
import { createDirectoryEntryAction, type DirectoryState } from "@/features/directory/actions";
import { DIRECTORY_STATUS_INFO, DIRECTORY_STATUS_LABELS } from "@/features/directory/schema";
import { Input, Select, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const initial: DirectoryState = { error: null };

export function NewDirectoryEntryForm({
  zones,
  categories,
  serviceTypes,
}: {
  zones: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  serviceTypes: { id: string; name: string; category_id: string | null }[];
}) {
  const [state, formAction, pending] = useActionState(createDirectoryEntryAction, initial);
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState("PROSPECTO");
  const types = serviceTypes.filter((t) => t.category_id === categoryId);

  return (
    <Card className="max-w-3xl">
      <form action={formAction} className="flex flex-col gap-5">
        <Input
          label="Nombre"
          name="name"
          required
          placeholder="Ej. Mago Ejemplo, Salón Las Palmas, Banda Tropical"
          info="Persona, grupo, empresa o lugar. Es lo único obligatorio."
        />

        <div>
          <p className="mb-2 text-sm font-medium text-brand-text">¿En qué paso está?</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {(["PROSPECTO", "EVALUADO", "APROBADO"] as const).map((s) => (
              <label
                key={s}
                className={`flex cursor-pointer items-start gap-2 rounded-[var(--radius-md)] border px-3 py-2 text-sm ${
                  status === s ? "border-brand-accent bg-brand-accent-light" : "border-brand-border hover:bg-brand-surface-hover"
                }`}
              >
                <input type="radio" name="directory_status" value={s} checked={status === s} onChange={() => setStatus(s)} className="mt-1" />
                <span>
                  <span className="block font-medium text-brand-text">{DIRECTORY_STATUS_LABELS[s]}</span>
                  <span className="block text-xs text-brand-muted">{DIRECTORY_STATUS_INFO[s]}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select
            label="Categoría (opcional)"
            name="category_id"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            info="La misma lista de categorías de los gastos (ej. Entretenimiento, Locales para eventos, Catering y alimentos)."
          >
            <option value="">— Sin categoría —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select label="Tipo de servicio (opcional)" name="service_type_id" defaultValue="" disabled={!categoryId || types.length === 0}>
            <option value="">{categoryId ? (types.length ? "— Elegir —" : "No hay tipos en esta categoría") : "Elige primero la categoría"}</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
          <Input label="Teléfono (opcional)" name="phone" placeholder="809-000-0000" />
          <Input label="Correo (opcional)" name="email" type="email" />
          <Select label="Zona (opcional)" name="zone_id" defaultValue="" info="Dónde trabaja o dónde está. La lista se cambia en Configuración → Directorio.">
            <option value="">— Sin zona —</option>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </Select>
          <Input
            label="Precio de referencia (opcional)"
            name="reference_price"
            placeholder="Ej. desde RD$15,000 por hora"
            info="Texto libre: lo que nos dijeron que cobra. No crea ningún gasto."
          />
        </div>
        <Textarea label="Notas (opcional)" name="directory_notes" rows={3} placeholder="Ej. Lo vimos en la boda de…; muy puntual; trae su propio sonido." />

        <div className="flex flex-col gap-2 border-t border-brand-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-brand-danger">{state.error}</p>
          <Button type="submit" loading={pending}>
            Guardar en el directorio
          </Button>
        </div>
      </form>
    </Card>
  );
}
