"use client";

import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";
import {
  EXPENSE_FISCAL_STATUS_HINTS,
  EXPENSE_FISCAL_STATUS_LABELS,
  EXPENSE_FISCAL_STATUS_TONE,
} from "@/features/fiscal/expense-labels";

/** Chip del estado fiscal del gasto, con su explicación al pasar el mouse. */
export function FiscalStatusBadge({ status }: { status: string }) {
  return (
    <Tooltip text={EXPENSE_FISCAL_STATUS_HINTS[status] ?? ""}>
      <span tabIndex={0} className="inline-flex cursor-help rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent">
        <Badge tone={EXPENSE_FISCAL_STATUS_TONE[status] ?? "neutral"}>
          Fiscal: {EXPENSE_FISCAL_STATUS_LABELS[status] ?? status}
        </Badge>
      </span>
    </Tooltip>
  );
}
