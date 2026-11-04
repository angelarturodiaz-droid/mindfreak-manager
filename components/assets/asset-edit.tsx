"use client";

import { useCallback, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { AssetForm, type AssetFormValues } from "./asset-form";

type Lists = {
  types: { id: string; name: string }[];
  locations: { id: string; name: string }[];
  responsibleSuggestions: string[];
  canEditLists: boolean;
};

/** Ficha: «Información» en modo lectura (la arma la página) y «Editar» → formulario con Cancelar y Guardar cambios. */
export function AssetDetailsPanel({
  assetId,
  values,
  canEdit,
  startEditing = false,
  children,
  ...lists
}: Lists & { assetId: string; values: AssetFormValues; canEdit: boolean; startEditing?: boolean; children: React.ReactNode }) {
  const [editing, setEditing] = useState(startEditing && canEdit);
  const router = useRouter();
  const pathname = usePathname();
  // Al terminar (guardar o cancelar) se quita «?editar=1» de la dirección y se ve la ficha actualizada.
  const close = useCallback(() => {
    setEditing(false);
    if (startEditing) router.replace(pathname, { scroll: false });
    else router.refresh();
  }, [router, pathname, startEditing]);

  if (editing) {
    return (
      <div id="datos" className="scroll-mt-4">
        <AssetForm
          assetId={assetId}
          initial={values}
          canEdit
          onCancel={close}
          onSaved={close}
          types={lists.types}
          locations={lists.locations}
          responsibleSuggestions={lists.responsibleSuggestions}
          canEditLists={lists.canEditLists}
        />
      </div>
    );
  }

  return (
    <Card className="flex flex-col gap-4" id="datos">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-brand-text">Información</h2>
        {canEdit ? (
          <Button size="sm" variant="outline" icon={<Pencil size={14} />} onClick={() => setEditing(true)} hint="Cambiar responsable, ubicación, estado, cantidad, valor o el nombre.">
            Editar
          </Button>
        ) : (
          <span className="text-xs text-brand-muted">Solo Administración y Gerente pueden editar.</span>
        )}
      </div>
      {children}
    </Card>
  );
}

/** Lista: lápiz que abre la edición en una ventana, sin entrar a la ficha. */
export function EditAssetButton({ assetId, code, values, ...lists }: Lists & { assetId: string; code: string; values: AssetFormValues }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const done = useCallback(() => {
    setOpen(false);
    router.refresh();
  }, [router]);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`Editar ${code} aquí mismo (responsable, ubicación, estado…)`}
        aria-label={`Editar ${code}`}
        className="rounded-[var(--radius-md)] p-1.5 text-brand-muted hover:bg-brand-surface-hover hover:text-brand-accent"
      >
        <Pencil size={15} />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Editar ${code} · ${values.description}`} size="lg">
        <AssetForm
          bare
          assetId={assetId}
          initial={values}
          canEdit
          onCancel={() => setOpen(false)}
          onSaved={done}
          types={lists.types}
          locations={lists.locations}
          responsibleSuggestions={lists.responsibleSuggestions}
          canEditLists={lists.canEditLists}
        />
      </Modal>
    </>
  );
}
