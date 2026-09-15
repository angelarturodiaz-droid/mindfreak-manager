"use client";

import { useTransition } from "react";
import { FileDown } from "lucide-react";
import { toast } from "@/components/ui/toaster";

export function DownloadReceiptButton({
  paymentId,
  label,
  generateAction,
}: {
  paymentId: string;
  label: string;
  generateAction: (paymentId: string) => Promise<{ url: string | null; error: string | null }>;
}) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await generateAction(paymentId);
      if (result.error || !result.url) {
        toast.error(result.error ?? "No se pudo generar el documento.");
        return;
      }
      window.open(result.url, "_blank");
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="inline-flex items-center gap-1 text-sm text-brand-accent hover:underline disabled:opacity-50"
    >
      <FileDown size={13} />
      {isPending ? "Generando…" : label}
    </button>
  );
}
