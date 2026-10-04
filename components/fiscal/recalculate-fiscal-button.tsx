"use client";

import { RefreshCw } from "lucide-react";
import { ActionButton } from "@/components/ui/action-button";
import { recalculateExpenseFiscalAction } from "@/features/expenses/actions";
import { FIELD_HINTS } from "@/lib/ui/field-hints";

export function RecalculateFiscalButton({ expenseId }: { expenseId: string }) {
  return (
    <ActionButton
      label="Recalcular"
      icon={<RefreshCw size={14} />}
      hint={FIELD_HINTS.fiscalRecalculate}
      successMessage="Tratamiento fiscal recalculado."
      onAction={async () => {
        const res = await recalculateExpenseFiscalAction(expenseId);
        if (res.error) throw new Error(res.error);
      }}
    />
  );
}
