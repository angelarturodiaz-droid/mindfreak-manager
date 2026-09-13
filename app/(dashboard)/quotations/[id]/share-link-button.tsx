"use client";

import { useState, useTransition } from "react";
import { FileDown, Link2, Download } from "lucide-react";
import { generateQuotationShareLinkAction } from "@/features/quotations/actions";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";

export function ShareLinkButton({ quotationId }: { quotationId: string }) {
  const [isPending, startTransition] = useTransition();
  const [url, setUrl] = useState<string | null>(null);

  function handleGenerate() {
    startTransition(async () => {
      const result = await generateQuotationShareLinkAction(quotationId);
      if (result.error) toast.error(result.error);
      else setUrl(result.url);
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
