"use client";

import { startTransition, useActionState, useEffect, useState, useTransition } from "react";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Input, Textarea } from "@/components/ui/field";
import { toast } from "@/components/ui/toaster";
import {
  createFiscalClassificationAction,
  toggleFiscalClassificationAction,
  updateFiscalClassificationAction,
  type ClassificationState,
} from "@/features/fiscal/classification-actions";
import type { FiscalClassification } from "@/features/fiscal/classification-queries";

/** Lista de clasificaciones fiscales: agregar, renombrar, activar/desactivar. */
export function ClassificationsManager({
  classifications,
  usage,
}: {
  classifications: FiscalClassification[];
  usage: Record<string, number>;
}) {
  const [editing, setEditing] = useState<FiscalClassification | "new" | null>(null);
  const [pending, startToggle] = useTransition();

  return (
    <div className="flex flex-col gap-3">
      <ul className="divide-y divide-brand-border rounded-[var(--radius-md)] border border-brand-border">
        {classifications.map((c) => (
          <li key={c.id} className={`flex items-start gap-3 px-3 py-2.5 ${c.is_active ? "" : "bg-brand-background"}`}>
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-medium ${c.is_active ? "text-brand-text" : "text-brand-muted line-through"}`}>
                {c.name}
                <span className="ml-2 text-xs font-normal text-brand-muted">
                  {usage[c.id] ?? 0} tipo{(usage[c.id] ?? 0) === 1 ? "" : "s"}
                </span>
              </p>
              {c.description && <p className="text-xs text-brand-muted">{c.description}</p>}
            </div>
            {!c.is_active && <Badge tone="warning">Inactiva</Badge>}
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={`Editar ${c.name}`}
              hint="Cambiar el nombre o la descripción."
              onClick={() => setEditing(c)}
            >
              <Pencil size={14} />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() =>
                startToggle(async () => {
                  try {
                    await toggleFiscalClassificationAction(c.id);
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "No se pudo cambiar.");
                  }
                })
              }
            >
              {c.is_active ? "Desactivar" : "Activar"}
            </Button>
          </li>
        ))}
      </ul>
      <div>
        <Button type="button" size="sm" variant="outline" icon={<Plus size={14} />} onClick={() => setEditing("new")}>
          Nueva clasificación
        </Button>
      </div>
      {editing && (
        <ClassificationDialog
          key={editing === "new" ? "new" : editing.id}
          classification={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function ClassificationDialog({
  classification,
  onClose,
}: {
  classification: FiscalClassification | null;
  onClose: () => void;
}) {
  const action = classification
    ? updateFiscalClassificationAction.bind(null, classification.id)
    : createFiscalClassificationAction;
  const [state, formAction, pending] = useActionState<ClassificationState, FormData>(action, { error: null });

  useEffect(() => {
    if (state.successId) {
      toast.success(state.success ?? "Guardado.");
      onClose();
    }
  }, [state.successId, state.success, onClose]);

  return (
    <Modal open onClose={() => !pending && onClose()} title={classification ? "Editar clasificación" : "Nueva clasificación fiscal"}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          startTransition(() => formAction(fd));
        }}
        className="flex flex-col gap-4"
      >
        <Input label="Nombre" name="name" required defaultValue={classification?.name ?? ""} placeholder="Ej. Publicidad" />
        <Textarea
          label="Descripción (opcional)"
          name="description"
          rows={2}
          defaultValue={classification?.description ?? ""}
          hint="Explica en palabras simples qué servicios entran aquí."
        />
        {state.error && <p className="text-sm text-brand-danger">{state.error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" loading={pending}>
            {classification ? "Guardar" : "Crear"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
