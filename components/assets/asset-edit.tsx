"use client";

import { useCallback, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { formatMoney } from "@/lib/utils/money";
import { formatDate } from "@/lib/utils/dates";
import { ASSET_STATUS_INFO, ASSET_STATUS_LABELS, ASSET_STATUS_TONES, formatQuantity } from "@/features/assets/schema";
import { AssetForm, type AssetFormValues } from "./asset-form";

type Lists = {
  types: { id: string; name: string }[];
  locations: { id: string; name: string }[];
  responsibleSuggestions: string[];
  canEditLists: boolean;
};

/** Ficha: «Datos del activo» en modo lectura, con «Editar» → formulario con Cancelar y Guardar cambios. */
export function AssetDetailsPanel({
  assetId,
  values,
  canEdit,
  startEditing = false,
  ...lists
}: Lists & { assetId: string; values: AssetFormValues; canEdit: boolean; startEditing?: boolean }) {
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
      <div id="datos">
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

  const typeName = lists.types.find((t) => t.id === values.typeId)?.name ?? null;
  const locationName = lists.locations.find((l) => l.id === values.locationId)?.name ?? null;
  const rows: [string, React.ReactNode][] = [
    ["Tipo", typeName ?? "—"],
    ["Cantidad", formatQuantity(values.quantity)],
    [
      "Estado",
      <span key="st" title={ASSET_STATUS_INFO[values.status]} className={`rounded-full px-2 py-0.5 text-xs font-medium ${ASSET_STATUS_TONES[values.status]}`}>
        {ASSET_STATUS_LABELS[values.status]}
      </span>,
    ],
    ["¿Se consume?", values.isConsumable ? "Sí (se gasta o se regala en los eventos)" : "No (activo fijo)"],
    ["Responsable", values.responsibleName ?? "—"],
    ["Ubicación", locationName ?? "—"],
    ["Valor de compra", values.value ? formatMoney(values.value, values.currency) : "—"],
    ["Fecha de compra", values.purchaseDate ? formatDate(values.purchaseDate) : "—"],
  ];

  return (
    <Card className="flex flex-col gap-3" id="datos">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-brand-text">Datos del activo</p>
        {canEdit && (
          <Button size="sm" variant="secondary" icon={<Pencil size={14} />} onClick={() => setEditing(true)} hint="Cambiar responsable, ubicación, estado, cantidad, valor o el nombre.">
            Editar
          </Button>
        )}
      </div>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2.5 text-sm sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex flex-col">
            <dt className="text-xs text-brand-muted">{label}</dt>
            <dd className="text-brand-text">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-col border-t border-brand-border pt-2.5 text-sm">
        <span className="text-xs text-brand-muted">Detalle</span>
        <span className="text-brand-text">{values.detail ?? "—"}</span>
      </div>
      {!canEdit && <p className="text-xs text-brand-muted">Solo Administración y Gerente pueden editar los activos.</p>}
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
