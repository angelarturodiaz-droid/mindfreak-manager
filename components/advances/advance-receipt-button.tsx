"use client";

import { useTransition } from "react";
import { FileDown } from "lucide-react";
import { toast } from "@/components/ui/toaster";
import { getAdvanceReceiptDataAction, uploadAdvanceReceiptAction } from "@/features/advances/actions";

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/**
 * «Recibo de anticipo» en PDF (ANT-0001). Se arma en el navegador (igual
 * que el recibo de cobro) y se abre en otra pestaña.
 */
export function AdvanceReceiptButton({
  advanceId,
  label = "Recibo de anticipo (PDF)",
  variant = "link",
}: {
  advanceId: string;
  label?: string;
  variant?: "link" | "button";
}) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const { data, error } = await getAdvanceReceiptDataAction(advanceId);
      if (error || !data) {
        toast.error(error ?? "No se pudieron leer los datos del anticipo.");
        return;
      }
      const [{ pdf }, { AdvanceReceiptPdfDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/lib/pdf/advance-receipt-document"),
      ]);
      const blob = await pdf(AdvanceReceiptPdfDocument(data)).toBlob();
      const result = await uploadAdvanceReceiptAction(advanceId, await blobToBase64(blob));
      if (result.error || !result.url) {
        toast.error(result.error ?? "No se pudo generar el recibo.");
        return;
      }
      window.open(result.url, "_blank");
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      title="Descarga el recibo para enviárselo al cliente. No es factura: el monto se descuenta de la factura final."
      className={
        variant === "button"
          ? "inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-brand-primary px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          : "inline-flex items-center gap-1 text-sm text-brand-accent hover:underline disabled:opacity-50"
      }
    >
      <FileDown size={variant === "button" ? 15 : 13} />
      {pending ? "Generando…" : label}
    </button>
  );
}
