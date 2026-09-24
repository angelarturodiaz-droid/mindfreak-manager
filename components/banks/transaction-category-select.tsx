"use client";

import { useTransition } from "react";
import { setTransactionCategoryAction } from "@/features/banks/actions";
import { toast } from "@/components/ui/toaster";

/**
 * Selector de categoría en la fila de un movimiento: al cambiarlo se
 * guarda al instante (solo la categoría). Muestra un toast si falla.
 */
export function TransactionCategorySelect({
  transactionId,
  bankAccountId,
  value,
  categories,
}: {
  transactionId: string;
  bankAccountId: string;
  value: string | null;
  categories: { id: string; name: string }[];
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <select
      value={value ?? ""}
      disabled={isPending}
      aria-label="Categoría del movimiento"
      onChange={(e) => {
        const next = e.target.value || null;
        startTransition(async () => {
          try {
            await setTransactionCategoryAction(transactionId, bankAccountId, next);
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "No se pudo guardar la categoría.");
          }
        });
      }}
      className={`max-w-[12rem] rounded-full border px-2.5 py-1 text-xs font-medium outline-none focus:ring-2 focus:ring-brand-accent disabled:opacity-60 ${
        value
          ? "border-brand-accent/30 bg-brand-accent-light text-brand-accent"
          : "border-dashed border-brand-border bg-brand-surface text-brand-muted"
      }`}
    >
      <option value="">Sin categoría</option>
      {categories.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}
