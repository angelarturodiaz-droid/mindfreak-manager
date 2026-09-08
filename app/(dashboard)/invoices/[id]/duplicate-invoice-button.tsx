"use client";

import { useTransition } from "react";
import { duplicateInvoiceAction } from "@/features/invoices/actions";

export function DuplicateInvoiceButton({ invoiceId }: { invoiceId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => duplicateInvoiceAction(invoiceId))}
      className="border border-brand-muted/30 px-4 py-2 text-sm text-brand-text hover:border-brand-accent disabled:opacity-50"
    >
      {isPending ? "Duplicando…" : "Duplicar factura"}
    </button>
  );
}
