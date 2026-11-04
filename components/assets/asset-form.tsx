"use client";

import { useActionState, useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FIELD_CLASSES, FieldWrapper, Input, Select, Textarea } from "@/components/ui/field";
import { ResultDialog } from "@/components/ui/result-dialog";
import { useSuccessToast } from "@/components/ui/use-success-toast";
import { createAssetAction, updateAssetAction, type AssetState } from "@/features/assets/actions";
import { ASSET_STATUS_INFO, ASSET_STATUS_LABELS, ASSET_STATUSES, type AssetCurrency, type AssetStatus } from "@/features/assets/schema";

export type AssetFormValues = {
  description: string;
  detail: string | null;
  typeId: string | null;
  quantity: number;
  responsibleName: string | null;
  locationId: string | null;
  value: number | null;
  currency: AssetCurrency;
  purchaseDate: string | null;
  status: AssetStatus;
  isConsumable: boolean;
};

const EMPTY: AssetFormValues = {
  description: "",
  detail: null,
  typeId: null,
  quantity: 1,
  responsibleName: null,
  locationId: null,
  value: null,
  currency: "DOP",
  purchaseDate: null,
  status: "EN_USO",
  isConsumable: false,
};

function fmtAmount(raw: string): string {
  const clean = raw.replace(/[,\s]/g, "").replace(/^(RD|US)?\$/i, "");
  if (!clean) return "";
  const n = Number(clean);
  return Number.isFinite(n) ? n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : raw;
}

/** Formulario del activo: «Nuevo activo» (assetId vacío) o editar en su ficha. */
export function AssetForm({
  assetId,
  initial,
  types,
  locations,
  responsibleSuggestions,
  expenseId,
  canEdit = true,
  canEditLists = false,
  onCancel,
  onSaved,
  bare = false,
}: {
  assetId?: string;
  initial?: Partial<AssetFormValues>;
  types: { id: string; name: string }[];
  locations: { id: string; name: string }[];
  responsibleSuggestions: string[];
  expenseId?: string | null;
  canEdit?: boolean;
  /** Puede entrar a Configuración → Activos (Administración). */
  canEditLists?: boolean;
  /** Editar: botón «Cancelar» (descarta lo escrito y cierra la edición). */
  onCancel?: () => void;
  /** Editar: se llama al guardar bien (para cerrar la edición o la ventana). */
  onSaved?: () => void;
  /** Sin la tarjeta de fondo (dentro de una ventana). */
  bare?: boolean;
}) {
  const v = { ...EMPTY, ...initial };
  const action = assetId ? updateAssetAction.bind(null, assetId) : createAssetAction;
  const [state, formAction, pending] = useActionState(action, { error: null } as AssetState);
  const [, startTransition] = useTransition();
  const [currency, setCurrency] = useState<AssetCurrency>(v.currency);
  const [consumable, setConsumable] = useState(v.isConsumable);
  const [popup, setPopup] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<{ field?: string; msg?: string }>({});
  const [seen, setSeen] = useState<number | undefined>(undefined);
  useSuccessToast(state);

  // Guardado bien → cerrar la edición o la ventana.
  const savedRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (state.successId && state.successId !== savedRef.current) {
      savedRef.current = state.successId;
      onSaved?.();
    }
  }, [state.successId, onSaved]);

  // Error del servidor → ventana + campo en rojo (estado derivado, sin efecto).
  if (state.error && state.errorId && state.errorId !== seen) {
    setSeen(state.errorId);
    setPopup(state.error);
    setFieldError({ field: state.field, msg: state.error });
  }
  const errorFor = (f: string) => (fieldError.field === f ? fieldError.msg : undefined);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    // Envío sin el reinicio automático del formulario (no se pierde lo escrito si hay un error).
    e.preventDefault();
    const form = e.currentTarget;
    const desc = (form.elements.namedItem("description") as HTMLInputElement).value.trim();
    if (desc.length < 2) {
      setFieldError({ field: "description", msg: "Escribe qué es (ej. «Mesa plegable blanca»)." });
      setPopup("Falta la descripción: escribe qué es (ej. «Mesa plegable blanca»).");
      return;
    }
    setFieldError({});
    const fd = new FormData(form);
    startTransition(() => formAction(fd));
  }

  const listId = `responsables-${assetId ?? "nuevo"}`;

  return (
    <Wrapper bare={bare}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        {expenseId && <input type="hidden" name="expense_id" value={expenseId} />}
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-brand-text">Datos del activo</p>
          <p className="text-xs text-brand-muted">Solo la descripción es obligatoria.</p>
        </div>

        <Input
          label="¿Qué es?"
          name="description"
          required
          defaultValue={v.description}
          disabled={!canEdit}
          placeholder="Ej. Mesa plegable blanca, Bocina JBL, Polos con logo"
          info="Nombre corto para reconocerlo en la lista. Si son varios iguales, escribe uno solo y pon la cantidad abajo."
          error={errorFor("description")}
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Select label="Tipo" name="type_id" defaultValue={v.typeId ?? ""} disabled={!canEdit} info="Para agrupar y filtrar. La lista se cambia en Configuración → Activos.">
            <option value="">— Sin tipo —</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
          <Input
            label="Cantidad"
            name="quantity"
            type="number"
            min="0.01"
            step="1"
            defaultValue={String(v.quantity)}
            disabled={!canEdit}
            info="Cuántas unidades iguales hay (ej. 15 jarrones). Las flechas van de 1 en 1; una fracción se escribe a mano."
            error={errorFor("quantity")}
          />
          <Select label="Estado" name="status" defaultValue={v.status} disabled={!canEdit} info="En uso: se puede usar. En reparación: no contar con él por ahora. Dado de baja: ya no se usa (queda en la lista para el historial; los activos no se borran).">
            {ASSET_STATUSES.map((s) => (
              <option key={s} value={s} title={ASSET_STATUS_INFO[s]}>
                {ASSET_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </div>

        <label className="flex cursor-pointer items-start gap-2 rounded-[var(--radius-md)] border border-brand-border p-3 text-sm">
          <input
            type="checkbox"
            name="is_consumable"
            checked={consumable}
            disabled={!canEdit}
            onChange={(e) => setConsumable(e.currentTarget.checked)}
            className="mt-0.5 h-4 w-4 accent-[var(--color-brand-accent)]"
          />
          <span>
            <span className="font-medium text-brand-text">¿Se consume o se regala?</span>
            <span className="block text-xs text-brand-muted">
              Márcalo para lo que se gasta o se entrega en los eventos (gorras, polos, lanyards, soportes de gafetes). No son activos
              fijos: se llevan aquí para saber cuántos quedan.
            </span>
          </span>
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Input
              label="Responsable"
              name="responsible_name"
              list={listId}
              defaultValue={v.responsibleName ?? ""}
              disabled={!canEdit}
              placeholder="Quién lo tiene o lo cuida"
              info="Escribe el nombre o elígelo de la lista (usuarios del sistema y responsables ya usados). Cada cambio queda en el historial."
            />
            <datalist id={listId}>
              {responsibleSuggestions.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>
          <div>
            <Select label="Ubicación" name="location_id" defaultValue={v.locationId ?? ""} disabled={!canEdit} info="Dónde está guardado. La lista se cambia en Configuración → Activos.">
              <option value="">— Sin ubicación —</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
            {canEditLists ? (
              <Link href="/settings/assets" className="mt-1 inline-block text-xs text-brand-accent hover:underline">
                Agregar otra ubicación o tipo →
              </Link>
            ) : (
              canEdit && <p className="mt-1 text-xs text-brand-muted">¿Falta una ubicación o un tipo? Pídeselo a Administración.</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FieldWrapper
            label="Valor de compra"
            htmlFor={`valor-${assetId ?? "nuevo"}`}
            info="Lo que costó en total (todas las unidades), en pesos o dólares. Si no lo sabes, déjalo vacío. Es informativo: no crea gastos ni cambia saldos."
            error={errorFor("value")}
          >
            <div className="flex gap-2">
              <select
                name="currency"
                aria-label="Moneda del valor"
                value={currency}
                disabled={!canEdit}
                onChange={(e) => setCurrency(e.currentTarget.value as AssetCurrency)}
                className={`${FIELD_CLASSES.replace("w-full ", "")} w-[5.5rem] shrink-0 px-2`}
              >
                <option value="DOP">RD$</option>
                <option value="USD">US$</option>
              </select>
              <input
                id={`valor-${assetId ?? "nuevo"}`}
                name="value"
                inputMode="decimal"
                defaultValue={v.value === null ? "" : fmtAmount(String(v.value))}
                disabled={!canEdit}
                placeholder="Ej. 2,135.00"
                onBlur={(e) => {
                  e.currentTarget.value = fmtAmount(e.currentTarget.value);
                }}
                className={`${FIELD_CLASSES} min-w-0 flex-1 text-right tabular-nums ${errorFor("value") ? "border-brand-danger" : ""}`}
              />
            </div>
          </FieldWrapper>
          <Input
            label="Fecha de compra"
            name="purchase_date"
            type="date"
            defaultValue={v.purchaseDate ?? ""}
            disabled={!canEdit}
            info="Cuándo se compró (si la sabes)."
          />
        </div>

        <Textarea
          label="Detalle (opcional)"
          name="detail"
          rows={2}
          defaultValue={v.detail ?? ""}
          disabled={!canEdit}
          placeholder="Ej. Color, tamaño, marca, número de serie, qué incluye."
        />

        {canEdit && (
          <div className="flex items-center justify-end gap-2 border-t border-brand-border pt-3">
            {onCancel ? (
              <Button type="button" variant="secondary" onClick={onCancel} disabled={pending} hint="Descarta lo que cambiaste y deja el activo como estaba.">
                Cancelar
              </Button>
            ) : (
              !assetId && (
                <Link href="/assets" className="px-3 text-sm text-brand-muted hover:text-brand-text">
                  Cancelar
                </Link>
              )
            )}
            <Button type="submit" loading={pending}>
              {assetId ? "Guardar cambios" : "Registrar activo"}
            </Button>
          </div>
        )}
      </form>
      <ResultDialog open={popup !== null} tone="danger" title="Revisa este dato" onClose={() => setPopup(null)}>
        <p className="text-brand-text">{popup}</p>
      </ResultDialog>
    </Wrapper>
  );
}

function Wrapper({ bare, children }: { bare: boolean; children: React.ReactNode }) {
  return bare ? <div>{children}</div> : <Card>{children}</Card>;
}
