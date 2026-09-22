"use client";

import { useTransition } from "react";
import { FileDown } from "lucide-react";
import { toast } from "@/components/ui/toaster";
import {
  getPaymentReceiptDataAction,
  uploadPaymentReceiptAction,
  getSupplierPaymentReceiptDataAction,
  uploadSupplierPaymentReceiptAction,
} from "@/features/payments/actions";

// El render del PDF (`pdf()`) se hace en el navegador — Cloudflare Workers
// no soporta la compilación dinámica de WASM que usa yoga-layout. El
// servidor solo entrega los datos y sube el resultado a Storage. Ver
// features/payments/actions.ts.
async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export function DownloadReceiptButton({
  paymentId,
  label,
  kind,
}: {
  paymentId: string;
  label: string;
  kind: "customer" | "supplier";
}) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      let url: string | null = null;
      let error: string | null = null;

      if (kind === "customer") {
        const { data, error: dataError } = await getPaymentReceiptDataAction(paymentId);
        if (dataError || !data) {
          toast.error(dataError ?? "No se pudo obtener los datos del cobro.");
          return;
        }
        // Import dinámico: ver comentario en invoices/[id]/share-link-button.tsx.
        const [{ pdf }, { ReceiptPdfDocument }] = await Promise.all([
          import("@react-pdf/renderer"),
          import("@/lib/pdf/receipt-document"),
        ]);
        const blob = await pdf(ReceiptPdfDocument(data)).toBlob();
        const pdfBase64 = await blobToBase64(blob);
        const result = await uploadPaymentReceiptAction(paymentId, pdfBase64);
        url = result.url;
        error = result.error;
      } else {
        const { data, error: dataError } = await getSupplierPaymentReceiptDataAction(paymentId);
        if (dataError || !data) {
          toast.error(dataError ?? "No se pudo obtener los datos del pago.");
          return;
        }
        const [{ pdf }, { SupplierReceiptPdfDocument }] = await Promise.all([
          import("@react-pdf/renderer"),
          import("@/lib/pdf/supplier-receipt-document"),
        ]);
        const blob = await pdf(SupplierReceiptPdfDocument(data)).toBlob();
        const pdfBase64 = await blobToBase64(blob);
        const result = await uploadSupplierPaymentReceiptAction(paymentId, pdfBase64);
        url = result.url;
        error = result.error;
      }

      if (error || !url) {
        toast.error(error ?? "No se pudo generar el documento.");
        return;
      }
      window.open(url, "_blank");
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
