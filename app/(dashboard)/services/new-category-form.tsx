"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { ChevronRight, Layers, Pencil, Plus, Search, Trash2 } from "lucide-react";
import {
  createServiceCategoryAction,
  deleteServiceCategoryAction,
  updateServiceCategoryAction,
  type ActionState,
} from "@/features/services/actions";
import { ResultDialog } from "@/components/ui/result-dialog";
import { toast } from "@/components/ui/toaster";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { useSuccessToast } from "@/components/ui/use-success-toast";

const initialState: ActionState = { error: null };

export type CategoryRow = { id: string; name: string; description: string | null; count: number };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/**
 * 4-nov: botón «Categorías» junto a «Nuevo producto/servicio». Abre una ventana para ver las categorías
 * (con cuántos productos tiene cada una, buscador y «Ver productos») y, si eres Administración, agregar una nueva.
 */
export function CategoriesButton({ categories, canManage }: { categories: CategoryRow[]; canManage: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        icon={<Layers size={14} />}
        onClick={() => setOpen(true)}
        hint="Ver las categorías del catálogo, cuántos productos tiene cada una y agregar nuevas."
      >
        Categorías ({categories.length})
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Categorías del catálogo" size="lg">
        {open && <CategoriesManager categories={categories} canManage={canManage} onClose={() => setOpen(false)} />}
      </Modal>
    </>
  );
}

function CategoriesManager({ categories, canManage, onClose }: { categories: CategoryRow[]; canManage: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const shown = useMemo(() => categories.filter((c) => !q || norm(c.name).includes(norm(q))), [categories, q]);
  // Nombres repetidos que ya existían (ej. «Capacitacion» ×2): se marcan para borrar el que está vacío.
  const dupKeys = useMemo(() => {
    const seen = new Map<string, number>();
    for (const c of categories) seen.set(norm(c.name), (seen.get(norm(c.name)) ?? 0) + 1);
    return new Set([...seen].filter(([, n]) => n > 1).map(([k]) => k));
  }, [categories]);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-brand-muted">
        Las categorías agrupan el catálogo y sirven para filtrar la lista. Pulsa <em>Ver productos</em> para ver los de una categoría.
        {canManage && " Con el lápiz cambias el nombre o la descripción; la papelera solo borra categorías vacías."}
      </p>

      {canManage ? (
        <NewCategoryInline />
      ) : (
        <p className="rounded-[var(--radius-md)] bg-brand-surface-hover px-3 py-2 text-xs text-brand-muted">
          Solo <strong>Administración</strong> puede agregar categorías.
        </p>
      )}

      <label className="relative block">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted" aria-hidden />
        <input
          value={q}
          onChange={(e) => setQ(e.currentTarget.value)}
          placeholder="Buscar categoría…"
          aria-label="Buscar categoría"
          className="w-full rounded-[var(--radius-md)] border border-brand-border bg-brand-surface py-2 pl-9 pr-3 text-sm"
        />
      </label>

      <ul className="max-h-[45vh] divide-y divide-brand-border overflow-y-auto rounded-[var(--radius-md)] border border-brand-border">
        {shown.length === 0 ? (
          <li className="px-3 py-4 text-center text-sm text-brand-muted">No hay categorías con «{q}».</li>
        ) : (
          shown.map((c) => (
            <CategoryRowItem
              key={c.id}
              c={c}
              canManage={canManage}
              repeated={dupKeys.has(norm(c.name))}
              onNavigate={onClose}
            />
          ))
        )}
      </ul>
    </div>
  );
}

function NewCategoryInline() {
  const [state, formAction, pending] = useActionState(createServiceCategoryAction, initialState);
  const [, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  useSuccessToast(state);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    startTransition(() => formAction(fd));
  }
  // Agregada bien → limpiar el formulario para poder agregar otra.
  useEffect(() => {
    if (state.successId) formRef.current?.reset();
  }, [state.successId]);

  return (
    <form ref={formRef} onSubmit={onSubmit} className="rounded-[var(--radius-md)] border border-brand-border bg-brand-surface-hover p-3">
      <p className="mb-2 text-sm font-medium text-brand-text">Nueva categoría</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Input label="Nombre" name="name" placeholder="Ej. Audio, Catering" required info="No se puede repetir (no cuentan mayúsculas ni acentos)." />
        <Input label="Descripción (opcional)" name="description" placeholder="Qué agrupa" />
        <Button type="submit" loading={pending} icon={<Plus size={14} />}>
          Agregar
        </Button>
      </div>
      {state.error && <p className="mt-2 text-sm text-brand-danger">{state.error}</p>}
    </form>
  );
}

function CategoryRowItem({
  c,
  canManage,
  repeated,
  onNavigate,
}: {
  c: CategoryRow;
  canManage: boolean;
  repeated: boolean;
  onNavigate: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, startDelete] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onDelete() {
    startDelete(async () => {
      const res = await deleteServiceCategoryAction(c.id);
      if (res.error) setError(res.error);
      else if (res.success) toast.success(res.success);
      setConfirming(false);
    });
  }

  if (editing) return <CategoryEditRow c={c} onDone={() => setEditing(false)} />;

  return (
    <li className="flex items-center justify-between gap-3 px-3 py-2">
      <span className="min-w-0">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-brand-text">{c.name}</span>
          {repeated && <Badge tone="warning">Repetida</Badge>}
        </span>
        {c.description && <span className="block truncate text-xs text-brand-muted">{c.description}</span>}
      </span>
      <span className="flex shrink-0 items-center gap-3">
        <span className="text-xs text-brand-muted">
          {c.count} {c.count === 1 ? "producto" : "productos"}
        </span>
        <Link
          href={`/services?category=${c.id}`}
          onClick={onNavigate}
          className="inline-flex items-center gap-0.5 text-xs font-medium text-brand-accent hover:underline"
        >
          Ver productos <ChevronRight size={12} aria-hidden />
        </Link>
        {canManage &&
          (confirming ? (
            <span className="inline-flex items-center gap-1 text-xs">
              <span className="text-brand-text">¿Borrar?</span>
              <Button type="button" size="sm" variant="danger" loading={deleting} onClick={onDelete}>
                Sí, borrar
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={deleting}>
                No
              </Button>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <button
                type="button"
                onClick={() => setEditing(true)}
                title="Cambiar el nombre o la descripción"
                aria-label={`Editar ${c.name}`}
                className="rounded-[var(--radius-md)] p-1 text-brand-muted hover:bg-brand-surface-hover hover:text-brand-accent"
              >
                <Pencil size={14} />
              </button>
              <button
                type="button"
                onClick={() => (c.count > 0 ? setError(`«${c.name}» tiene ${c.count} ${c.count === 1 ? "producto" : "productos"}: muévelos a otra categoría (en cada producto, Categoría) antes de borrarla.`) : setConfirming(true))}
                title={c.count > 0 ? "Tiene productos: no se puede borrar" : "Borrar esta categoría (está vacía)"}
                aria-label={`Borrar ${c.name}`}
                className={`rounded-[var(--radius-md)] p-1 hover:bg-brand-surface-hover ${c.count > 0 ? "text-brand-muted/40" : "text-brand-muted hover:text-brand-danger"}`}
              >
                <Trash2 size={14} />
              </button>
            </span>
          ))}
      </span>
      <ResultDialog open={error !== null} tone="danger" title="No se puede borrar" onClose={() => setError(null)}>
        <p className="text-brand-text">{error}</p>
      </ResultDialog>
    </li>
  );
}

function CategoryEditRow({ c, onDone }: { c: CategoryRow; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(updateServiceCategoryAction.bind(null, c.id), initialState);
  const [, startTransition] = useTransition();
  useSuccessToast(state);
  useEffect(() => {
    if (state.successId) onDone();
  }, [state.successId, onDone]);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => formAction(fd));
  }

  return (
    <li className="bg-brand-surface-hover px-3 py-2">
      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Input label="Nombre" name="name" defaultValue={c.name} required />
        <Input label="Descripción" name="description" defaultValue={c.description ?? ""} placeholder="Opcional" />
        <span className="flex gap-1">
          <Button type="button" variant="outline" size="sm" onClick={onDone} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" size="sm" loading={pending}>
            Guardar
          </Button>
        </span>
      </form>
      {state.error && <p className="mt-1 text-sm text-brand-danger">{state.error}</p>}
    </li>
  );
}
