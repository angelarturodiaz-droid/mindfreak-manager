"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Tooltip } from "@/components/ui/tooltip";
import { ResultDialog } from "@/components/ui/result-dialog";
import { toast } from "@/components/ui/toaster";
import { updateProjectItemCostAction } from "@/features/projects/actions";

/** Corregir el costo estimado de una línea (dato interno; precio y cantidad no cambian). */
export function EditCostButton({
  itemId,
  projectId,
  description,
  quantity,
  unitCost,
}: {
  itemId: string;
  projectId: string;
  description: string;
  quantity: number;
  unitCost: number;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(String(unitCost));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    const n = Number(value.replace(/,/g, ""));
    startTransition(async () => {
      const r = await updateProjectItemCostAction(itemId, projectId, n);
      if (r.error) setError(r.error);
      else {
        setOpen(false);
        toast.success("Costo estimado actualizado.");
      }
    });
  }

  return (
    <>
      <Tooltip text="Corregir el costo estimado (lo que crees que te costará). Es interno: no cambia el precio al cliente.">
        <button
          type="button"
          onClick={() => {
            setValue(String(unitCost));
            setOpen(true);
          }}
          aria-label={`Corregir costo de ${description}`}
          className="rounded p-1 text-brand-muted hover:bg-brand-surface-hover hover:text-brand-accent"
        >
          <Pencil size={13} />
        </button>
      </Tooltip>
      <Modal open={open} onClose={() => setOpen(false)} title="Corregir costo estimado">
        <div className="flex flex-col gap-3">
          <p className="text-sm text-brand-muted">
            <strong className="text-brand-text">{description}</strong> · cantidad {quantity}. El precio al cliente no cambia;
            solo la utilidad estimada. Queda en la Auditoría.
          </p>
          <Input
            label="Costo por unidad"
            type="number"
            min={0}
            step="0.01"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            hint={`Costo total: ${(Number(value || 0) * quantity).toLocaleString("es-DO", { minimumFractionDigits: 2 })}`}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" loading={pending} onClick={save}>
              Guardar
            </Button>
          </div>
        </div>
      </Modal>
      <ResultDialog open={Boolean(error)} tone="danger" title="No se guardó" onClose={() => setError(null)}>
        {error}
      </ResultDialog>
    </>
  );
}
