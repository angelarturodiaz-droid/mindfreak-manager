"use client";

import { useActionState, useState, useTransition } from "react";
import { ArrowRight, Check, ImagePlus, Lock, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/field";
import { InfoHint } from "@/components/ui/info-hint";
import { ResultDialog } from "@/components/ui/result-dialog";
import {
  setCoverPhotoAction,
  setDirectoryStatusAction,
  updateDirectoryInfoAction,
  type DirectoryState,
} from "@/features/directory/actions";
import {
  DIRECTORY_FLOW,
  DIRECTORY_STATUS_INFO,
  DIRECTORY_STATUS_LABELS,
  LINK_FIELDS,
  directoryNextStep,
  type DirectoryLinks,
  type DirectoryStatus,
} from "@/features/directory/schema";

/** Avance del directorio con «Siguiente paso» y botón para avanzar. */
export function DirectoryStatusBar({
  supplierId,
  status,
  hasHistory,
  canEdit,
  missingFiscal,
}: {
  supplierId: string;
  status: DirectoryStatus;
  hasHistory: boolean;
  canEdit: boolean;
  missingFiscal: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<DirectoryState | null>(null);
  const current = DIRECTORY_FLOW.indexOf(status);
  const next = directoryNextStep(status);

  function move(to: DirectoryStatus) {
    startTransition(async () => setResult(await setDirectoryStatusAction(supplierId, to)));
  }

  return (
    <Card className="flex flex-col gap-3">
      <p className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-brand-muted">
        Avance en el directorio
        <InfoHint text="Prospecto → Evaluado → Aprobado → Proveedor. Haz clic en un paso para moverlo (si ya tiene gastos o pagos, solo puede quedar como Proveedor o Inactivo)." />
      </p>
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {DIRECTORY_FLOW.map((s, i) => {
          const done = status !== "INACTIVO" && i < current;
          const isCurrent = s === status;
          const locked = hasHistory && s !== "PROVEEDOR";
          const clickable = canEdit && !isCurrent && !locked && status !== "INACTIVO";
          return (
            <li key={s}>
              <button
                type="button"
                disabled={!clickable || pending}
                onClick={() => move(s)}
                title={locked ? "Ya tiene gastos o pagos: no puede volver a este paso." : DIRECTORY_STATUS_INFO[s]}
                className={`flex w-full items-center gap-2 rounded-[var(--radius-md)] border px-3 py-2 text-left text-sm transition-colors ${
                  isCurrent
                    ? "border-brand-accent/50 bg-brand-accent-light font-semibold text-brand-text"
                    : done
                      ? "border-brand-success/40 bg-brand-success-bg text-brand-text"
                      : "border-brand-border bg-brand-surface text-brand-muted"
                } ${clickable ? "hover:border-brand-accent/50" : "cursor-default"}`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${
                    done ? "bg-brand-success text-white" : isCurrent ? "bg-brand-accent text-white" : "bg-brand-surface-hover"
                  }`}
                >
                  {done ? <Check size={13} /> : locked && !isCurrent ? <Lock size={11} /> : i + 1}
                </span>
                {DIRECTORY_STATUS_LABELS[s]}
              </button>
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-brand-accent/30 bg-brand-accent-light px-3 py-2 text-sm">
        <span className="flex items-start gap-1.5 text-brand-text">
          <ArrowRight size={15} className="mt-0.5 shrink-0 text-brand-accent" aria-hidden />
          <span>
            <strong>Siguiente paso:</strong> {next.text}
            {next.to === "PROVEEDOR" && missingFiscal && (
              <span className="mt-0.5 block text-xs text-brand-warning">
                Falta RNC/cédula o tipo fiscal: se puede convertir igual y completarlo antes de pagarle (pestaña Resumen).
              </span>
            )}
          </span>
        </span>
        {canEdit && next.to && next.button && (
          <Button size="sm" loading={pending} onClick={() => move(next.to!)}>
            {next.button}
          </Button>
        )}
      </div>
      <ResultDialog
        open={result !== null}
        tone={result?.error ? "danger" : "success"}
        title={result?.error ? "No se pudo cambiar" : "Listo"}
        onClose={() => setResult(null)}
      >
        <p className="text-brand-text">{result?.error ?? result?.success}</p>
      </ResultDialog>
    </Card>
  );
}

/** Zona, enlaces, precio, notas, calificación y etiquetas. */
export function DirectoryInfoForm({
  supplierId,
  canEdit,
  zones,
  tags,
  info,
}: {
  supplierId: string;
  canEdit: boolean;
  zones: { id: string; name: string }[];
  tags: { id: string; name: string }[];
  info: { zoneId: string | null; links: DirectoryLinks; referencePrice: string | null; notes: string | null; rating: number | null; tagIds: string[] };
}) {
  const [state, formAction, pending] = useActionState(updateDirectoryInfoAction.bind(null, supplierId), { error: null } as DirectoryState);
  const [rating, setRating] = useState(info.rating ?? 0);
  const [selected, setSelected] = useState<string[]>(info.tagIds);

  return (
    <Card>
      <form action={formAction} className="flex flex-col gap-4">
        <p className="text-sm font-medium text-brand-text">Datos del directorio</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select label="Zona" name="zone_id" defaultValue={info.zoneId ?? ""} disabled={!canEdit} info="Dónde trabaja o dónde está.">
            <option value="">— Sin zona —</option>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </Select>
          <Input
            label="Precio de referencia"
            name="reference_price"
            defaultValue={info.referencePrice ?? ""}
            disabled={!canEdit}
            placeholder="Ej. desde RD$15,000 por hora"
            info="Texto libre: lo que cobra según nos dijeron. No crea ningún gasto."
          />
        </div>

        <div>
          <p className="mb-1 flex items-center gap-1 text-sm font-medium text-brand-text">
            Calificación <InfoHint text="Qué tan bueno es, de 1 a 5 estrellas, según nuestra experiencia o referencias." />
          </p>
          <input type="hidden" name="rating" value={rating || ""} />
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                disabled={!canEdit}
                onClick={() => setRating(rating === n ? 0 : n)}
                aria-label={`${n} estrellas`}
                className="rounded p-0.5 disabled:cursor-default"
              >
                <Star size={22} className={n <= rating ? "fill-amber-400 text-amber-400" : "text-brand-border"} />
              </button>
            ))}
            <span className="ml-2 text-xs text-brand-muted">{rating ? `${rating} de 5` : "Sin calificar"}</span>
          </div>
        </div>

        <div>
          <p className="mb-1 flex items-center gap-1 text-sm font-medium text-brand-text">
            Etiquetas <InfoHint text="Para encontrarlo rápido con los filtros (ej. Bodas, Corporativo). La lista se cambia en Configuración → Directorio." />
          </p>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => {
              const on = selected.includes(t.id);
              return (
                <label
                  key={t.id}
                  className={`cursor-pointer rounded-full border px-2.5 py-1 text-xs ${
                    on ? "border-brand-accent bg-brand-accent-light font-medium text-brand-accent" : "border-brand-border text-brand-muted hover:bg-brand-surface-hover"
                  }`}
                >
                  <input
                    type="checkbox"
                    name="tag_ids"
                    value={t.id}
                    checked={on}
                    disabled={!canEdit}
                    onChange={() => setSelected(on ? selected.filter((x) => x !== t.id) : [...selected, t.id])}
                    className="sr-only"
                  />
                  {t.name}
                </label>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {LINK_FIELDS.map((f) => (
            <Input
              key={f.key}
              label={f.label}
              name={`link_${f.key}`}
              defaultValue={info.links[f.key] ?? ""}
              disabled={!canEdit}
              placeholder={f.placeholder}
            />
          ))}
        </div>
        <Textarea
          label="Notas"
          name="directory_notes"
          rows={3}
          defaultValue={info.notes ?? ""}
          disabled={!canEdit}
          placeholder="Ej. Lo vimos en la boda de…; puntual; trae su propio sonido."
        />
        {canEdit && (
          <div className="flex flex-col gap-2 border-t border-brand-border pt-3 sm:flex-row sm:items-center sm:justify-between">
            <p className={`text-sm ${state.error ? "text-brand-danger" : "text-brand-success"}`}>{state.error ?? state.success}</p>
            <Button type="submit" loading={pending}>
              Guardar
            </Button>
          </div>
        )}
      </form>
    </Card>
  );
}

/** Galería de fotos: la primera (o la elegida) es la portada de la tarjeta. */
export function PhotoGallery({
  supplierId,
  photos,
  coverId,
  canEdit,
  uploadSlot,
}: {
  supplierId: string;
  photos: { id: string; name: string; url: string | null }[];
  coverId: string | null;
  canEdit: boolean;
  uploadSlot?: React.ReactNode;
}) {
  const [pending, startTransition] = useTransition();
  const effectiveCover = coverId ?? photos[0]?.id ?? null;
  return (
    <Card className="flex flex-col gap-3">
      <p className="flex items-center gap-1 text-sm font-medium text-brand-text">
        Fotos <span className="text-xs font-normal text-brand-muted">({photos.length})</span>
        <InfoHint text="Sube fotos de su trabajo (JPG o PNG). La portada sale en la tarjeta del directorio. También se ven en la pestaña Documentos." />
      </p>
      {photos.length === 0 ? (
        <p className="flex items-center gap-2 rounded-[var(--radius-md)] border border-dashed border-brand-border p-4 text-sm text-brand-muted">
          <ImagePlus size={16} aria-hidden /> Todavía no hay fotos. Súbelas abajo.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((p) => (
            <figure key={p.id} className="group relative overflow-hidden rounded-[var(--radius-md)] border border-brand-border">
              {p.url ? (
                <a href={p.url} target="_blank" rel="noreferrer" title="Ver en grande">
                  {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada de Storage */}
                  <img src={p.url} alt={p.name} className="aspect-square w-full object-cover" />
                </a>
              ) : (
                <div className="aspect-square w-full bg-brand-surface-hover" />
              )}
              {p.id === effectiveCover ? (
                <span className="absolute left-1.5 top-1.5 rounded-full bg-brand-accent px-2 py-0.5 text-[11px] font-medium text-white">Portada</span>
              ) : (
                canEdit && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => startTransition(() => setCoverPhotoAction(supplierId, p.id))}
                    className="absolute left-1.5 top-1.5 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-medium text-brand-text opacity-0 shadow transition-opacity group-hover:opacity-100"
                  >
                    Usar de portada
                  </button>
                )
              )}
            </figure>
          ))}
        </div>
      )}
      {uploadSlot}
    </Card>
  );
}
