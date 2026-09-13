"use client";

import { useTransition } from "react";
import { deleteExpenseCategoryAction } from "@/features/expense-categories/actions";

export function DeleteExpenseCategoryButton({
  categoryId,
  categoryName,
  expenseCount,
}: {
  categoryId: string;
  categoryName: string;
  expenseCount: number;
}) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    const message =
      expenseCount > 0
        ? `"${categoryName}" tiene ${expenseCount} gasto(s) asociado(s). Si la eliminas, esos gastos quedarán sin categoría (no se borran). ¿Continuar?`
        : `¿Eliminar la categoría "${categoryName}"?`;
    if (!window.confirm(message)) return;
    startTransition(() => deleteExpenseCategoryAction(categoryId));
  }

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={handleClick}
      className="text-brand-muted hover:text-brand-danger disabled:opacity-50"
    >
      Eliminar
    </button>
  );
}
