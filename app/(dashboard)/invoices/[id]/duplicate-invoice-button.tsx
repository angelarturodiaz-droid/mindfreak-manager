"use client";

import { useTransition } from "react";
import { Copy } from "lucide-react";
import { duplicateInvoiceAction } from "@/features/invoices/actions";
import { Button } from "@/components/ui/button";

export function DuplicateInvoiceButton({ invoiceId }: { invoiceId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      loading={isPending}
      icon={<Copy size={14} />}
      onClick={() => startTransition(() => duplicateInvoiceAction(invoiceId))}
    >
      Duplicar factura
    </Button>
  );
}
