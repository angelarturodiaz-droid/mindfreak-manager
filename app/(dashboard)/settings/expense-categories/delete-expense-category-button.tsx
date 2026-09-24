"use client";

import { deleteExpenseCategoryAction } from "@/features/expense-categories/actions";
import { ConfirmButton } from "@/components/ui/confirm-button";

export function DeleteExpenseCategoryButton({
  categoryId,
  categoryName,
  expenseCount,
}: {
  categoryId: string;
  categoryName: string;
  expenseCount: number;
}) {
  const message =
    expenseCount > 0
      ? `"${categoryName}" se usa en ${expenseCount} gasto(s) o movimiento(s) de banco. Si la eliminas, quedarán sin categoría (no se borran).`
      : undefined;

  return (
    <ConfirmButton
      label="Eliminar"
      confirmTitle={`¿Eliminar la categoría "${categoryName}"?`}
      confirmMessage={message}
      onConfirm={() => deleteExpenseCategoryAction(categoryId)}
    />
  );
}
