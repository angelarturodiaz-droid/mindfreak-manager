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
      ? `"${categoryName}" tiene ${expenseCount} gasto(s) asociado(s). Si la eliminas, esos gastos quedarán sin categoría (no se borran).`
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
