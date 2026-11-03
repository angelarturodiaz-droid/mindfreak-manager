"use client";

import { useActionState, useRef, useState, useTransition, type DragEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, ChevronDown, ExternalLink, ImagePlus, Link2, Lock, Star, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/field";
import { InfoHint } from "@/components/ui/info-hint";
import { ResultDialog } from "@/components/ui/result-dialog";
import { toast } from "@/components/ui/toaster";
import { useSuccessToast } from "@/components/ui/use-success-toast";
import { uploadDocumentAction } from "@/features/documents/actions";
import { PriceField } from "./price-field";
import {
  setDirectoryStatusAction,
  updateDirectoryInfoAction,
  type DirectoryState,
} from "@/features/directory/actions";
import {
  DIRECTORY_FLOW,
  DIRECTORY_STATUS_INFO,
  DIRECTORY_STATUS_LABELS,
  LINK_FIELDS,
  cleanLink,
  directoryNextStep,
  formatPriceText,
  invalidLinkMessage,
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
  const finished = status === "PROVEEDOR";
  const inactive = status === "INACTIVO";

  function move(to: DirectoryStatus) {
    startTransition(async () => setResult(await setDirectoryStatusAction(supplierId, to)));
  }

  return (
    <Card padded={false} className="flex flex-col gap-2.5 px-5 py-3">
      <p className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-brand-muted">
        Avance en el directorio
        <InfoHint text="Prospecto → Evaluado → Aprobado → Proveedor. Verde = paso cumplido. Azul = donde está ahora. Haz clic en un paso para moverlo. El candado indica que ya tiene gastos o pagos: no puede volver a ese paso." />
      </p>
      <ol className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {DIRECTORY_FLOW.map((s, i) => {
          const isCurrent = s === status;
          // Proveedor es el último paso: cuando llega ahí, todo queda cumplido (verde).
          const done = !inactive && (i < current || (finished && isCurrent));
          const locked = hasHistory && s !== "PROVEEDOR";
          const clickable = canEdit && !isCurrent && !locked && !inactive;
          return (
            <li key={s}>
              <button
                type="button"
                disabled={!clickable || pending}
                onClick={() => move(s)}
                title={locked ? "Ya tiene gastos o pagos: no puede volver a este paso." : DIRECTORY_STATUS_INFO[s]}
                className={`flex w-full items-center gap-2 rounded-[var(--radius-md)] border px-2.5 py-1.5 text-left text-sm transition-colors ${
                  done
                    ? `border-brand-success/40 bg-brand-success-bg text-brand-text ${isCurrent ? "font-semibold ring-1 ring-brand-success/40" : ""}`
                    : isCurrent
                      ? "border-brand-accent/50 bg-brand-accent-light font-semibold text-brand-text"
                      : "border-brand-border bg-brand-surface text-brand-muted"
                } ${clickable ? "hover:border-brand-accent/50" : "cursor-default"}`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] ${
                    done ? "bg-brand-success text-white" : isCurrent ? "bg-brand-accent text-white" : "bg-brand-surface-hover"
                  }`}
                >
                  {done ? <Check size={12} /> : i + 1}
                </span>
                <span className="flex-1">{DIRECTORY_STATUS_LABELS[s]}</span>
                {locked && <Lock size={13} className="shrink-0 text-brand-muted" aria-label="Bloqueado" />}
              </button>
            </li>
          );
        })}
      </ol>
      <div
        className={`flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border px-3 py-1.5 text-sm ${
          finished ? "border-brand-success/40 bg-brand-success-bg" : inactive ? "border-brand-danger/30 bg-brand-danger-bg" : "border-brand-accent/30 bg-brand-accent-light"
        }`}
      >
        <span className="flex items-start gap-1.5 text-brand-text">
          {finished ? (
            <Check size={15} className="mt-0.5 shrink-0 text-brand-success" aria-hidden />
          ) : (
            <ArrowRight size={15} className="mt-0.5 shrink-0 text-brand-accent" aria-hidden />
          )}
          <span>
            {finished ? <strong>Listo: </strong> : <strong>Siguiente paso: </strong>}
            {next.text}
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
      {hasHistory && (
        <p className="flex items-center gap-1.5 text-xs text-brand-muted">
          <Lock size={12} aria-hidden /> Tiene gastos o pagos: ya no puede volver a Prospecto, Evaluado ni Aprobado. Solo puede quedar como
          Proveedor o Inactivo.
        </p>
      )}
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

type LinkKey = (typeof LINK_FIELDS)[number]["key"];

/** Zona, precio, calificación, etiquetas, enlaces y notas — agrupados y compactos. */
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
  const [, startTransition] = useTransition();
  const [rating, setRating] = useState(info.rating ?? 0);
  const [selected, setSelected] = useState<string[]>(info.tagIds);
  const [linkErrors, setLinkErrors] = useState<Partial<Record<LinkKey, string>>>({});
  const [linksOpen, setLinksOpen] = useState(false);
  const [popup, setPopup] = useState<string | null>(null);
  const [seenError, setSeenError] = useState<number | undefined>(undefined);
  useSuccessToast(state);

  // Error del servidor → ventana + campo en rojo (patrón de estado derivado, sin efecto).
  if (state.error && state.errorId && state.errorId !== seenError) {
    setSeenError(state.errorId);
    setPopup(state.error);
    if (state.field?.startsWith("link_")) {
      const key = state.field.slice(5) as LinkKey;
      setLinkErrors((e) => ({ ...e, [key]: state.error! }));
      setLinksOpen(true);
    }
  }

  const filledLinks = LINK_FIELDS.filter((f) => info.links[f.key]);

  function checkLink(key: LinkKey, input: HTMLInputElement) {
    const f = LINK_FIELDS.find((x) => x.key === key)!;
    const raw = input.value.trim();
    if (!raw) {
      setLinkErrors((e) => ({ ...e, [key]: undefined }));
      return true;
    }
    const clean = cleanLink(raw);
    if (!clean) {
      setLinkErrors((e) => ({ ...e, [key]: invalidLinkMessage(f.label, f.example) }));
      return false;
    }
    input.value = clean;
    setLinkErrors((e) => ({ ...e, [key]: undefined }));
    return true;
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    // Sin el reinicio automático del formulario (así no se pierden etiquetas ni lo escrito).
    e.preventDefault();
    const form = e.currentTarget;
    const bad = LINK_FIELDS.filter((f) => {
      const input = form.elements.namedItem(`link_${f.key}`) as HTMLInputElement | null;
      return input ? !checkLink(f.key, input) : false;
    });
    if (bad.length) {
      setLinksOpen(true);
      setPopup(invalidLinkMessage(bad[0].label, bad[0].example));
      return;
    }
    const price = form.elements.namedItem("reference_price") as HTMLInputElement | null;
    const cur = (form.elements.namedItem("price_currency") as HTMLSelectElement | null)?.value === "USD" ? "USD" : "DOP";
    if (price) price.value = formatPriceText(price.value, cur);
    const fd = new FormData(form);
    startTransition(() => formAction(fd));
  }

  return (
    <Card>
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-brand-text">Datos del directorio</p>
          <p className="text-xs text-brand-muted">Todo es opcional: llena lo que sepas.</p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select label="Zona" name="zone_id" defaultValue={info.zoneId ?? ""} disabled={!canEdit} info="Dónde trabaja o dónde está.">
            <option value="">— Sin zona —</option>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </Select>
          <PriceField defaultValue={info.referencePrice} disabled={!canEdit} />
        </div>

        <div>
          <p className="mb-1 flex items-center gap-1 text-sm font-medium text-brand-text">
            Calificación <InfoHint text="Qué tan bueno es, de 1 a 5 estrellas, según nuestra experiencia o referencias. Haz clic otra vez en la misma estrella para quitarla." />
          </p>
          <input type="hidden" name="rating" value={rating || ""} />
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                disabled={!canEdit}
                onClick={() => setRating(rating === n ? 0 : n)}
                aria-label={`${n} estrellas`}
                className="rounded p-0.5 disabled:cursor-default"
              >
                <Star size={20} className={n <= rating ? "fill-amber-400 text-amber-400" : "text-brand-border"} />
              </button>
            ))}
            <span className="ml-2 text-xs text-brand-muted">{rating ? `${rating} de 5` : "Sin calificar"}</span>
          </div>
        </div>

        <div>
          <p className="mb-1 flex items-center gap-1 text-sm font-medium text-brand-text">
            Etiquetas
            <span className="text-xs font-normal text-brand-muted">({selected.length} marcadas)</span>
            <InfoHint text="Haz clic para marcar o desmarcar. Sirven para encontrarlo rápido con los filtros (ej. Bodas, Corporativo). La lista se cambia en Configuración → Directorio." />
          </p>
          {selected.map((id) => (
            <input key={id} type="hidden" name="tag_ids" value={id} />
          ))}
          <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto pr-1">
            {tags.map((t) => {
              const on = selected.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  disabled={!canEdit}
                  aria-pressed={on}
                  onClick={() => setSelected(on ? selected.filter((x) => x !== t.id) : [...selected, t.id])}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs transition-colors disabled:cursor-default ${
                    on ? "border-brand-accent bg-brand-accent-light font-medium text-brand-accent" : "border-brand-border text-brand-muted hover:bg-brand-surface-hover"
                  }`}
                >
                  {on && <Check size={11} aria-hidden />}
                  {t.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-[var(--radius-md)] border border-brand-border">
          <button
            type="button"
            onClick={() => setLinksOpen(!linksOpen)}
            aria-expanded={linksOpen}
            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm"
          >
            <span className="flex items-center gap-1.5 font-medium text-brand-text">
              <Link2 size={14} aria-hidden /> Enlaces
              <span className="text-xs font-normal text-brand-muted">
                ({filledLinks.length} de {LINK_FIELDS.length}: página web, Instagram, video y mapa)
              </span>
            </span>
            <ChevronDown size={15} className={`text-brand-muted transition-transform ${linksOpen ? "rotate-180" : ""}`} aria-hidden />
          </button>
          {!linksOpen && filledLinks.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-3 pb-2">
              {filledLinks.map((f) => (
                <a
                  key={f.key}
                  href={info.links[f.key]}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-full bg-brand-surface-hover px-2 py-0.5 text-xs text-brand-accent hover:underline"
                >
                  {f.label} <ExternalLink size={10} aria-hidden />
                </a>
              ))}
            </div>
          )}
          <div className={`grid grid-cols-1 gap-3 border-t border-brand-border p-3 sm:grid-cols-2 ${linksOpen ? "" : "hidden"}`}>
            {LINK_FIELDS.map((f) => (
              <Input
                key={f.key}
                label={f.label}
                name={`link_${f.key}`}
                defaultValue={info.links[f.key] ?? ""}
                disabled={!canEdit}
                placeholder={f.placeholder}
                error={linkErrors[f.key]}
                onBlur={(e) => checkLink(f.key, e.currentTarget)}
              />
            ))}
          </div>
        </div>

        <Textarea
          label="Notas"
          name="directory_notes"
          rows={2}
          defaultValue={info.notes ?? ""}
          disabled={!canEdit}
          placeholder="Ej. Lo vimos en la boda de…; puntual; trae su propio sonido."
        />
        {canEdit && (
          <div className="flex justify-end border-t border-brand-border pt-3">
            <Button type="submit" loading={pending}>
              Guardar datos
            </Button>
          </div>
        )}
      </form>
      <ResultDialog open={popup !== null} tone="danger" title="Revisa este dato" onClose={() => setPopup(null)}>
        <p className="text-brand-text">{popup}</p>
      </ResultDialog>
    </Card>
  );
}

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_PHOTO = 15 * 1024 * 1024;

/** Elegir o arrastrar varias fotos a la vez (solo imágenes). */
function PhotoUploader({ entityType, entityId, pathToRefresh }: { entityType: "supplier" | "asset"; entityId: string; pathToRefresh: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<string[] | null>(null);
  const [dragging, setDragging] = useState(false);

  function upload(list: FileList | null) {
    const files = Array.from(list ?? []);
    if (!files.length) return;
    startTransition(async () => {
      const problems: string[] = [];
      let ok = 0;
      for (const f of files) {
        if (!PHOTO_TYPES.includes(f.type)) {
          problems.push(`«${f.name}»: solo fotos JPG, PNG o WEBP.`);
          continue;
        }
        if (f.size > MAX_PHOTO) {
          problems.push(`«${f.name}»: pesa más de 15 MB.`);
          continue;
        }
        const fd = new FormData();
        fd.append("file", f);
        const r = await uploadDocumentAction(entityType, entityId, pathToRefresh, { error: null }, fd);
        if (r.error) problems.push(`«${f.name}»: ${r.error}`);
        else ok += 1;
      }
      if (inputRef.current) inputRef.current.value = "";
      if (ok) {
        toast.success(ok === 1 ? "Foto subida." : `${ok} fotos subidas.`);
        router.refresh();
      }
      if (problems.length) setErrors(problems);
    });
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragging(false);
    upload(e.dataTransfer.files);
  }

  return (
    <>
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex cursor-pointer flex-col items-center gap-1 rounded-[var(--radius-md)] border-2 border-dashed px-3 py-3 text-center transition-colors ${
          dragging ? "border-brand-accent bg-brand-accent-light" : "border-brand-border hover:border-brand-accent/60 hover:bg-brand-surface-hover"
        } ${pending ? "pointer-events-none opacity-60" : ""}`}
      >
        <Upload size={18} className="text-brand-accent" aria-hidden />
        <span className="text-sm font-medium text-brand-text">{pending ? "Subiendo fotos…" : "Elegir fotos o arrastrarlas aquí"}</span>
        <span className="text-xs text-brand-muted">Puedes elegir varias a la vez · JPG, PNG o WEBP · hasta 15 MB cada una</span>
        <input
          ref={inputRef}
          type="file"
          accept={PHOTO_TYPES.join(",")}
          multiple
          className="sr-only"
          onChange={(e) => upload(e.currentTarget.files)}
        />
      </label>
      <ResultDialog open={errors !== null} tone="danger" title="Algunas fotos no se subieron" onClose={() => setErrors(null)}>
        <ul className="list-disc pl-5 text-left text-brand-text">
          {(errors ?? []).map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      </ResultDialog>
    </>
  );
}

/** Galería de fotos: la primera (o la elegida) es la portada de la tarjeta. */
export function PhotoGallery({
  entityType = "supplier",
  entityId,
  photos,
  coverId,
  canEdit,
  canUpload,
  setCover,
  help,
}: {
  entityType?: "supplier" | "asset";
  entityId: string;
  photos: { id: string; name: string; url: string | null }[];
  coverId: string | null;
  canEdit: boolean;
  canUpload: boolean;
  /** Acción del servidor (ya con el id) que marca la portada. */
  setCover: (documentId: string) => Promise<void>;
  /** Texto visible arriba de las fotos. */
  help?: React.ReactNode;
}) {
  const [pending, startTransition] = useTransition();
  const effectiveCover = coverId ?? photos[0]?.id ?? null;
  const pathToRefresh = entityType === "asset" ? `/assets/${entityId}` : `/suppliers/${entityId}`;
  return (
    <Card className="flex flex-col gap-3">
      <div>
        <p className="flex items-center gap-1 text-sm font-semibold text-brand-text">
          Fotos <span className="text-xs font-normal text-brand-muted">({photos.length})</span>
        </p>
        <p className="mt-0.5 text-xs text-brand-muted">
          {help ?? (
            <>
              Fotos de <strong>su trabajo</strong> para recordarlo y compararlo: montajes, eventos donde lo vimos, su equipo, su local o
              su menú. La que dice <strong>Portada</strong> es la que sale en la tarjeta del Directorio; para cambiarla pasa el mouse sobre
              otra y pulsa <em>Usar de portada</em>. Haz clic en una foto para verla en grande.
            </>
          )}
        </p>
      </div>
      {photos.length === 0 ? (
        <p className="flex items-center gap-2 rounded-[var(--radius-md)] bg-brand-surface-hover p-3 text-sm text-brand-muted">
          <ImagePlus size={16} aria-hidden /> Todavía no hay fotos.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-3">
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
                <span className="absolute left-1 top-1 rounded-full bg-brand-accent px-1.5 py-0.5 text-[10px] font-medium text-white">Portada</span>
              ) : (
                canEdit && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => startTransition(() => setCover(p.id))}
                    className="absolute inset-x-1 bottom-1 rounded-full bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-brand-text opacity-0 shadow transition-opacity group-hover:opacity-100"
                  >
                    Usar de portada
                  </button>
                )
              )}
            </figure>
          ))}
        </div>
      )}
      {canUpload && <PhotoUploader entityType={entityType} entityId={entityId} pathToRefresh={pathToRefresh} />}
    </Card>
  );
}
