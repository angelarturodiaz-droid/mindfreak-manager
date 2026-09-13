"use client";

import { useTransition } from "react";
import { Copy } from "lucide-react";
import { duplicateQuotationAction } from "@/features/quotations/actions";
import { Button } from "@/components/ui/button";

export function DuplicateQuotationButton({ quotationId }: { quotationId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      loading={isPending}
      icon={<Copy size={14} />}
      onClick={() => startTransition(() => duplicateQuotationAction(quotationId))}
    >
      Duplicar cotización
    </Button>
  );
}
