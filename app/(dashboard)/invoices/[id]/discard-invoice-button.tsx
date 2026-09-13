"use client";

import { Trash2 } from "lucide-react";
import { discardInvoiceAction } from "@/features/invoices/actions";
import { ConfirmButton } from "@/components/ui/confirm-button";

export function DiscardInvoiceButton({ invoiceId }: { invoiceId: string }) {
  return (
    <ConfirmButton
      label="Descartar borrador"
      icon={<Trash2 size={14} />}
      confirmTitle="¿Descartar esta factura en borrador?"
      confirmMessage="Se eliminará por completo, no quedará registro."
      onConfirm={() => discardInvoiceAction(invoiceId)}
    />
  );
}
