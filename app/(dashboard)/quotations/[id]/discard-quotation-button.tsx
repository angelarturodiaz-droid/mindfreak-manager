"use client";

import { useTransition } from "react";
import { discardQuotationAction } from "@/features/quotations/actions";

export function DiscardQuotationButton({ quotationId }: { quotationId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (
      !window.confirm(
        "¿Descartar esta cotización en borrador? Se eliminará por completo, no quedará registro.",
      )
    ) {
      return;
    }
    startTransition(() => discardQuotationAction(quotationId));
  }

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={handleClick}
      className="border border-brand-muted/30 px-4 py-2 text-sm text-brand-muted hover:border-brand-danger hover:text-brand-danger disabled:opacity-50"
    >
      {isPending ? "Descartando…" : "Descartar borrador"}
    </button>
  );
}
