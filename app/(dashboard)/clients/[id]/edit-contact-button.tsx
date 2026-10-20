"use client";

import { useActionState, useEffect, useState } from "react";
import { Pencil, Save, Undo2 } from "lucide-react";
import { updateContactAction, type ActionState } from "@/features/clients/actions";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { InfoHint } from "@/components/ui/info-hint";
import { ResultDialog } from "@/components/ui/result-dialog";
import { toast } from "@/components/ui/toaster";

export type EditableContact = {
  id: string;
  full_name: string;
  position: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
  receives_billing?: boolean;
};

/**
 * Botón «Editar» en la tarjeta de un contacto del cliente. Abre los mismos
 * campos de «Agregar contacto»; «Descartar cambios» cierra sin guardar.
 */
export function EditContactButton({ contact, clientId }: { contact: EditableContact; clientId: string }) {
  const [open, setOpen] = useState(false);
  // Cada vez que se abre, el formulario arranca con lo guardado.
  const [k, setK] = useState(0);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        icon={<Pencil size={14} />}
        title="Cambiar nombre, cargo, correo, teléfono o si recibe los recordatorios de cobro."
        onClick={() => {
          setK((n) => n + 1);
          setOpen(true);
        }}
      >
        Editar
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Editar a ${contact.full_name}`}>
        {open && <EditContactForm key={k} contact={contact} clientId={clientId} onDone={() => setOpen(false)} />}
      </Modal>
    </>
  );
}

const initialState: ActionState = { error: null };

function EditContactForm({
  contact,
  clientId,
  onDone,
}: {
  contact: EditableContact;
  clientId: string;
  onDone: () => void;
}) {
  const action = updateContactAction.bind(null, contact.id, clientId);
  const [state, formAction, pending] = useActionState(
    async (prev: ActionState, fd: FormData) => {
      const r = await action(prev, fd);
      return { ...r, at: Date.now() } as ActionState & { at: number };
    },
    initialState,
  );
  const [errorOpen, setErrorOpen] = useState<number | null>(null);
  const at = (state as ActionState & { at?: number }).at;

  useEffect(() => {
    if (!at) return;
    if (state.error) return;
    toast.success("Contacto guardado.");
    onDone();
  }, [at, state.error, onDone]);

  const showError = Boolean(state.error) && errorOpen !== at;

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <h3 className="flex items-center gap-1.5 text-base font-semibold text-brand-text">
        Editar contacto
        <InfoHint text="Cambia los datos de esta persona. Si marcas «Recibe recordatorios de cobro», los recordatorios de las facturas de este cliente le llegan a ella (necesita correo). «Descartar cambios» cierra sin guardar nada." />
      </h3>
      <Input name="full_name" label="Nombre completo" defaultValue={contact.full_name} required />
      <Input name="position" label="Cargo" defaultValue={contact.position ?? ""} />
      <Input name="email" type="email" label="Correo" defaultValue={contact.email ?? ""} />
      <Input name="phone" label="Teléfono" defaultValue={contact.phone ?? ""} />
      <label className="flex items-center gap-2 text-sm text-brand-text">
        <input type="checkbox" name="is_primary" defaultChecked={contact.is_primary} />
        Principal
      </label>
      <label className="flex items-center gap-2 text-sm text-brand-text">
        <input type="checkbox" name="receives_billing" defaultChecked={Boolean(contact.receives_billing)} />
        Recibe recordatorios de cobro
        <InfoHint text="Los recordatorios de las facturas le llegan a este contacto (ej. el contable). Si ningún contacto lo tiene marcado, van al correo del cliente." />
      </label>
      <div className="mt-2 flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" icon={<Undo2 size={14} />} onClick={onDone} disabled={pending}>
          Descartar cambios
        </Button>
        <Button type="submit" icon={<Save size={14} />} loading={pending}>
          Guardar
        </Button>
      </div>
      <ResultDialog open={showError} tone="danger" title="No se pudo guardar" onClose={() => setErrorOpen(at ?? 0)}>
        {state.error}
      </ResultDialog>
    </form>
  );
}
