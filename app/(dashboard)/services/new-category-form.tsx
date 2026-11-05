"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { createServiceCategoryAction, type ActionState } from "@/features/services/actions";
import { Input, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useSuccessToast } from "@/components/ui/use-success-toast";

const initialState: ActionState = { error: null };

/** 4-nov: botón «Nueva categoría» que abre una ventana (igual que «Nuevo producto/servicio»). */
export function NewCategoryButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="outline" size="sm" icon={<Plus size={14} />} onClick={() => setOpen(true)} hint="Crea una categoría para agrupar el catálogo.">
        Nueva categoría
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Nueva categoría">
        {open && <NewCategoryForm onDone={() => setOpen(false)} />}
      </Modal>
    </>
  );
}

function NewCategoryForm({ onDone }: { onDone: () => void }) {
  const [state, formAction, pending] = useActionState(createServiceCategoryAction, initialState);
  useSuccessToast(state);

  // Guardada bien → cerrar la ventana.
  const doneRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (state.successId && state.successId !== doneRef.current) {
      doneRef.current = state.successId;
      onDone();
    }
  }, [state.successId, onDone]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Input label="Nombre" name="name" placeholder="Ej. Audio, Catering, Decoración" required info="No se puede repetir (no cuentan mayúsculas ni acentos)." />
      <Textarea label="Descripción (opcional)" name="description" rows={2} placeholder="Qué agrupa esta categoría" />
      {state.error && <p className="text-sm text-brand-danger">{state.error}</p>}
      <div className="flex items-center justify-end gap-2 border-t border-brand-border pt-3">
        <Button type="button" variant="outline" onClick={onDone} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" loading={pending} icon={<Plus size={14} />}>
          Agregar categoría
        </Button>
      </div>
    </form>
  );
}
