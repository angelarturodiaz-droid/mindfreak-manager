"use client";

import { useState, useTransition } from "react";
import { FileDown, Link2, Download } from "lucide-react";
import { getQuotationPdfDataAction, uploadQuotationPdfAction } from "@/features/quotations/actions";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";

// El render del PDF (`pdf()`) se hace en el navegador — Cloudflare Workers
// no soporta la compilación dinámica de WASM que usa yoga-layout. El
// servidor solo entrega los datos y sube el resultado a Storage. Ver
// features/quotations/actions.ts.
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

export function ShareLinkButton({ quotationId }: { quotationId: string }) {
  const [isPending, startTransition] = useTransition();
  const [url, setUrl] = useState<string | null>(null);

  function handleGenerate() {
    startTransition(async () => {
      const { data, error } = await getQuotationPdfDataAction(quotationId);
      if (error || !data) {
        toast.error(error ?? "No se pudo obtener los datos de la cotización.");
        return;
      }

      // Import dinámico: ver comentario en invoices/[id]/share-link-button.tsx.
      const [{ pdf }, { QuotationPdfDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/lib/pdf/quotation-document"),
      ]);

      const blob = await pdf(QuotationPdfDocument(data)).toBlob();
      const pdfBase64 = await blobToBase64(blob);

      const result = await uploadQuotationPdfAction(quotationId, pdfBase64);
      if (result.error || !result.url) {
        toast.error(result.error ?? "No se pudo subir el PDF.");
        return;
      }
      setUrl(result.url);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        loading={isPending}
        onClick={handleGenerate}
        icon={<FileDown size={14} />}
      >
        Generar PDF / Link para compartir
      </Button>

      {url && (
        <div className="flex items-center gap-2 text-sm">
          <a href={url} target="_blank" rel="noreferrer" download>
            <Button type="button" variant="secondary" size="sm" icon={<Download size={14} />}>
              Descargar PDF
            </Button>
          </a>
          <input
            readOnly
            value={url}
            className="w-72 rounded-[var(--radius-md)] border border-brand-border bg-brand-surface px-2 py-1 text-xs text-brand-muted"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            icon={<Link2 size={14} />}
            onClick={() => {
              navigator.clipboard.writeText(url);
              toast.success("Link copiado");
            }}
          >
            Copiar
          </Button>
          <span className="text-xs text-brand-muted">(vence en 7 días)</span>
        </div>
      )}
    </div>
  );
}
