"use client";

import { useState, useTransition } from "react";
import { generateInvoiceShareLinkAction } from "@/features/invoices/actions";

export function InvoiceShareLinkButton({ invoiceId }: { invoiceId: string }) {
  const [isPending, startTransition] = useTransition();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function handleGenerate() {
    setError(null);
    setCopied(false);
    startTransition(async () => {
      const result = await generateInvoiceShareLinkAction(invoiceId);
      if (result.error) setError(result.error);
      else setUrl(result.url);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleGenerate}
        disabled={isPending}
        className="border border-brand-muted/30 px-4 py-2 text-sm text-brand-text hover:border-brand-accent disabled:opacity-50"
      >
        {isPending ? "Generando PDF…" : "Generar PDF / Link para compartir"}
      </button>

      {url && (
        <div className="flex items-center gap-2 text-sm">
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            download
            className="border border-brand-accent px-3 py-1.5 text-sm text-brand-accent hover:bg-brand-accent hover:text-white"
          >
            Descargar PDF
          </a>
          <input
            readOnly
            value={url}
            className="w-96 border border-brand-muted/30 bg-brand-surface px-2 py-1 text-xs text-brand-muted"
          />
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(url);
              setCopied(true);
            }}
            className="text-brand-accent hover:underline"
          >
            {copied ? "Copiado ✓" : "Copiar link"}
          </button>
          <span className="text-xs text-brand-muted">(vence en 7 días)</span>
        </div>
      )}
      {error && <p className="text-sm text-brand-danger">{error}</p>}
    </div>
  );
}
