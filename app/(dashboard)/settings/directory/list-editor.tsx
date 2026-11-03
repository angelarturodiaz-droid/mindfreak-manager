"use client";

import { useActionState, useTransition, type ReactNode } from "react";
import { X } from "lucide-react";
import { addListItemAction, deleteListItemAction, type DirectoryState, type ListTable } from "@/features/directory/actions";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export function ListEditor({
  table,
  title,
  icon,
  description,
  placeholder,
  items,
  canEdit,
}: {
  table: ListTable;
  title: string;
  icon: ReactNode;
  description: string;
  placeholder: string;
  items: { id: string; name: string }[];
  canEdit: boolean;
}) {
  const [state, formAction, pending] = useActionState(addListItemAction.bind(null, table), { error: null } as DirectoryState);
  const [removing, startTransition] = useTransition();
  return (
    <section>
      <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold text-brand-primary">
        {icon} {title} <span className="text-sm font-normal text-brand-muted">({items.length})</span>
      </h2>
      <p className="mb-3 text-sm text-brand-muted">{description}</p>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {items.map((i) => (
          <span key={i.id} className="inline-flex items-center gap-1 rounded-full border border-brand-border bg-brand-surface px-2.5 py-1 text-sm text-brand-text">
            {i.name}
            {canEdit && (
              <button
                type="button"
                disabled={removing}
                onClick={() => startTransition(() => deleteListItemAction(table, i.id))}
                aria-label={`Quitar ${i.name}`}
                title="Quitar de la lista"
                className="rounded-full p-0.5 text-brand-muted hover:bg-brand-danger-bg hover:text-brand-danger"
              >
                <X size={12} />
              </button>
            )}
          </span>
        ))}
      </div>
      {canEdit && (
        <form key={state.successId ?? 0} action={formAction} className="flex max-w-md items-end gap-2">
          <Input name="name" placeholder={placeholder} aria-label={`Nueva ${title.toLowerCase()}`} className="flex-1" />
          <Button type="submit" size="sm" loading={pending}>
            Agregar
          </Button>
        </form>
      )}
      {state.error && <p className="mt-1 text-sm text-brand-danger">{state.error}</p>}
    </section>
  );
}
