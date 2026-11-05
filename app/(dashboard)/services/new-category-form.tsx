"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { ChevronRight, Layers, Plus, Search } from "lucide-react";
import { createServiceCategoryAction, type ActionState } from "@/features/services/actions";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
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

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-brand-muted">
        Las categorías agrupan el catálogo y sirven para filtrar la lista. Pulsa <em>Ver productos</em> para ver los de una categoría.
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
            <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-brand-text">{c.name}</span>
                {c.description && <span className="block truncate text-xs text-brand-muted">{c.description}</span>}
              </span>
              <span className="flex shrink-0 items-center gap-3">
                <span className="text-xs text-brand-muted">
                  {c.count} {c.count === 1 ? "producto" : "productos"}
                </span>
                <Link
                  href={`/services?category=${c.id}`}
                  onClick={onClose}
                  className="inline-flex items-center gap-0.5 text-xs font-medium text-brand-accent hover:underline"
                >
                  Ver productos <ChevronRight size={12} aria-hidden />
                </Link>
              </span>
            </li>
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
