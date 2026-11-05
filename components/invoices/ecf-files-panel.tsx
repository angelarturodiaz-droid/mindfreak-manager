"use client";

import { useActionState, useRef, useState, type FormEvent, useTransition } from "react";
import { FileCheck2, FileCode2, FileText, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResultDialog } from "@/components/ui/result-dialog";
import { useSuccessToast } from "@/components/ui/use-success-toast";
import { attachEcfFileAction, type EcfFileState } from "@/features/invoices/ecf-files";

export type EcfFile = { id: string; name: string; kind: "pdf" | "xml"; url: string | null; createdAt: string };

/** Lista y carga del e-CF de la DGII (PDF y XML) en la tarjeta «Factura electrónica (e-CF)». */
export function EcfFilesPanel({ invoiceId, files, canUpload }: { invoiceId: string; files: EcfFile[]; canUpload: boolean }) {
  const [state, formAction, pending] = useActionState(attachEcfFileAction.bind(null, invoiceId), { error: null } as EcfFileState);
  const [, startTransition] = useTransition();
  const [closed, setClosed] = useState<EcfFileState | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  useSuccessToast(state);

  const latestPdf = files.find((f) => f.kind === "pdf");
  const latestXml = files.find((f) => f.kind === "xml");
  const complete = Boolean(latestPdf && latestXml);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => formAction(fd));
    if (inputRef.current) inputRef.current.value = "";
    setChosen([]);
  }

  return (
    <div className={`rounded-[var(--radius-md)] border p-3 ${complete ? "border-brand-success/40 bg-brand-success-bg" : "border-brand-warning/40 bg-brand-warning-bg"}`}>
      <p className="flex items-center gap-1.5 text-sm font-medium text-brand-text">
        <FileCheck2 size={15} aria-hidden />
        {complete ? "e-CF de la DGII adjunto" : "Falta adjuntar el e-CF de la DGII"}
      </p>
      <p className="mt-0.5 text-xs text-brand-muted">
        {complete
          ? "Este es el comprobante válido: es el que se le comparte al cliente."
          : `Sube el ${latestPdf ? "XML" : latestXml ? "PDF" : "PDF y el XML"} que generó el Facturador. El PDF es el que se le envía al cliente.`}
      </p>

      {files.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1 text-sm">
          {files.map((f) => {
            const isLatest = f.id === latestPdf?.id || f.id === latestXml?.id;
            return (
              <li key={f.id} className={`flex items-center gap-1.5 ${isLatest ? "" : "opacity-60"}`}>
                {f.kind === "pdf" ? <FileText size={14} aria-hidden /> : <FileCode2 size={14} aria-hidden />}
                {f.url ? (
                  <a href={f.url} target="_blank" rel="noreferrer" className="truncate text-brand-accent hover:underline">
                    {f.name}
                  </a>
                ) : (
                  <span className="truncate">{f.name}</span>
                )}
                <span className="shrink-0 text-xs text-brand-muted">{f.kind.toUpperCase()}{isLatest ? "" : " · versión anterior"}</span>
              </li>
            );
          })}
        </ul>
      )}

      {canUpload && (
        <form onSubmit={onSubmit} className="mt-2 flex flex-col gap-2">
          <label className="flex cursor-pointer items-center gap-2 rounded-[var(--radius-md)] border border-dashed border-brand-border bg-brand-surface px-3 py-2 text-sm text-brand-text hover:border-brand-accent">
            <Upload size={14} aria-hidden />
            <span className="truncate">{chosen.length ? chosen.join(", ") : "Elegir el PDF y el XML del e-CF"}</span>
            <input
              ref={inputRef}
              type="file"
              name="files"
              multiple
              accept=".pdf,.xml,application/pdf,application/xml,text/xml"
              className="sr-only"
              onChange={(e) => setChosen(Array.from(e.currentTarget.files ?? []).map((f) => f.name))}
            />
          </label>
          <Button type="submit" size="sm" loading={pending} disabled={!chosen.length} className="w-fit">
            Adjuntar e-CF de la DGII
          </Button>
          <p className="text-xs text-brand-muted">
            No se pueden borrar (son la evidencia fiscal). Si subiste uno equivocado, sube el correcto: vale el más reciente.
          </p>
        </form>
      )}

      <ResultDialog open={Boolean(state.error) && closed !== state} tone="danger" title="Revisa el archivo del e-CF" onClose={() => setClosed(state)}>
        <p className="text-brand-text">{state.error}</p>
      </ResultDialog>
    </div>
  );
}
