"use client";

import { useTransition } from "react";
import { duplicateQuotationAction } from "@/features/quotations/actions";

export function DuplicateQuotationButton({ quotationId }: { quotationId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => duplicateQuotationAction(quotationId))}
      className="border border-brand-muted/30 px-4 py-2 text-sm text-brand-text hover:border-brand-accent disabled:opacity-50"
    >
      {isPending ? "Duplicando…" : "Duplicar cotización"}
    </button>
  );
}
