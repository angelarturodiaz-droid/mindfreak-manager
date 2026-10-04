"use client";

import { useState, useTransition } from "react";
import { toast } from "@/components/ui/toaster";
import { FIELD_CLASSES } from "@/components/ui/field";
import { setServiceTypeClassificationAction } from "@/features/fiscal/classification-actions";

type Option = { id: string; name: string; is_active: boolean };

/** Selector en la fila del tipo de servicio: se guarda al elegir. */
export function ServiceTypeClassificationSelect({
  serviceTypeId,
  serviceTypeName,
  value,
  options,
  disabled,
}: {
  serviceTypeId: string;
  serviceTypeName: string;
  value: string | null;
  options: Option[];
  disabled?: boolean;
}) {
  const [current, setCurrent] = useState(value ?? "");
  const [pending, startTransition] = useTransition();

  return (
    <select
      aria-label={`Clasificación fiscal de ${serviceTypeName}`}
      value={current}
      disabled={disabled || pending}
      onChange={(e) => {
        const next = e.target.value;
        const prev = current;
        setCurrent(next);
        startTransition(async () => {
          try {
            await setServiceTypeClassificationAction(serviceTypeId, next || null);
            toast.success(next ? "Clasificación fiscal guardada." : "Se quitó la clasificación fiscal.");
          } catch (err) {
            setCurrent(prev);
            toast.error(err instanceof Error ? err.message : "No se pudo guardar.");
          }
        });
      }}
      className={`${FIELD_CLASSES} !py-1.5 w-56 ${current ? "" : "!border-brand-warning/60 text-brand-muted"}`}
    >
      <option value="">Sin clasificar</option>
      {options
        .filter((o) => o.is_active || o.id === current)
        .map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
            {o.is_active ? "" : " (inactiva)"}
          </option>
        ))}
    </select>
  );
}
