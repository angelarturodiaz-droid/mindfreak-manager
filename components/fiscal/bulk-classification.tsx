"use client";

import { useState, useTransition } from "react";
import { Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/field";
import { toast } from "@/components/ui/toaster";
import { bulkSetServiceTypeClassificationAction } from "@/features/fiscal/classification-actions";

/**
 * Asignar la misma clasificación fiscal a todos los tipos de servicio que
 * se ven con el filtro actual (ej. toda la categoría "Seguridad").
 */
export function BulkClassification({
  serviceTypeIds,
  description,
  options,
}: {
  serviceTypeIds: string[];
  description: string;
  options: { id: string; name: string; is_active: boolean }[];
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [pending, startTransition] = useTransition();
  const count = serviceTypeIds.length;
  if (count === 0) return null;

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        icon={<Layers size={14} />}
        className="whitespace-nowrap"
        hint="Pone la misma clasificación fiscal a todos los tipos de servicio que ves con el filtro actual."
        onClick={() => {
          setValue("");
          setOpen(true);
        }}
      >
        {`Clasificar los ${count} filtrados`}
      </Button>
      <Modal open={open} onClose={() => !pending && setOpen(false)} title="Clasificar varios a la vez">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-brand-muted">
            Se aplicará a <strong className="text-brand-text">{count}</strong> tipo{count === 1 ? "" : "s"} de servicio ({description}).
            Reemplaza la clasificación que tengan ahora.
          </p>
          <Select label="Clasificación fiscal" value={value} onChange={(e) => setValue(e.target.value)}>
            <option value="">Sin clasificar (quitar)</option>
            {options
              .filter((o) => o.is_active)
              .map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
          </Select>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button
              type="button"
              loading={pending}
              onClick={() =>
                startTransition(async () => {
                  try {
                    const res = await bulkSetServiceTypeClassificationAction(serviceTypeIds, value || null);
                    toast.success(`Listo: ${res.updated} tipo${res.updated === 1 ? "" : "s"} de servicio actualizados.`);
                    setOpen(false);
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "No se pudo guardar.");
                  }
                })
              }
            >
              Aplicar
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
