"use client";

import { Trash2 } from "lucide-react";
import { discardQuotationAction } from "@/features/quotations/actions";
import { ConfirmButton } from "@/components/ui/confirm-button";

export function DiscardQuotationButton({ quotationId }: { quotationId: string }) {
  return (
    <ConfirmButton
      label="Descartar borrador"
      icon={<Trash2 size={14} />}
      confirmTitle="¿Descartar esta cotización en borrador?"
      confirmMessage="Se eliminará por completo, no quedará registro."
      onConfirm={() => discardQuotationAction(quotationId)}
    />
  );
}
