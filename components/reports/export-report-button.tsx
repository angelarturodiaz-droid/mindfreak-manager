"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Download, FileSpreadsheet, FileText, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResultDialog } from "@/components/ui/result-dialog";
import { toast } from "@/components/ui/toaster";
import { getReportExportAction } from "@/features/reports/export-actions";
import { exportFileName } from "@/features/reports/export-types";

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Botón "Exportar" de Reportes: Excel (.xlsx) o PDF con los filtros de la
 * pantalla y TODAS las filas (no solo la página). El servidor entrega los
 * datos y el archivo se arma en el navegador.
 */
export function ExportReportButton({
  report,
  params,
}: {
  report: string;
  params: Record<string, string | undefined>;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<"xlsx" | "pdf" | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function run(format: "xlsx" | "pdf") {
    setOpen(false);
    setBusy(format);
    start(async () => {
      try {
        const { data, error: err } = await getReportExportAction(report, params, format);
        if (err || !data) {
          setError(err ?? "No se pudo preparar el reporte.");
          return;
        }
        if (format === "xlsx") {
          const { buildReportXlsx } = await import("@/lib/export/report-xlsx");
          const bytes = buildReportXlsx(data);
          download(
            new Blob([bytes as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
            exportFileName(data, "xlsx"),
          );
        } else {
          // Import dinámico: el motor de PDF es pesado y solo se carga al usarlo.
          const [{ pdf }, { ReportPdfDocument }] = await Promise.all([
            import("@react-pdf/renderer"),
            import("@/lib/pdf/report-document"),
          ]);
          const blob = await pdf(ReportPdfDocument(data)).toBlob();
          download(blob, exportFileName(data, "pdf"));
        }
        toast.success(format === "xlsx" ? "Excel descargado." : "PDF descargado.");
      } catch (e) {
        console.error(e);
        setError("No se pudo generar el archivo. Intenta de nuevo; si sigue fallando, prueba el otro formato.");
      } finally {
        setBusy(null);
      }
    });
  }

  return (
    <div ref={ref} className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        icon={<Download size={14} />}
        loading={pending}
        onClick={() => setOpen((v) => !v)}
        hint="Descarga este reporte con los filtros aplicados y todas las filas, para analizarlo o enviarlo al contador"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {busy === "xlsx" ? "Preparando Excel…" : busy === "pdf" ? "Preparando PDF…" : "Exportar"}
        {!pending && <ChevronDown size={14} className="ml-0.5" aria-hidden />}
      </Button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1 w-64 overflow-hidden rounded-[var(--radius-md)] border border-brand-border bg-brand-surface shadow-[var(--shadow-lg)]"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => run("xlsx")}
            className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left text-sm hover:bg-brand-surface-hover"
          >
            <FileSpreadsheet size={18} className="mt-0.5 shrink-0 text-brand-success" aria-hidden />
            <span>
              <span className="block font-medium text-brand-text">Excel (.xlsx)</span>
              <span className="block text-xs text-brand-muted">Para analizar: números y fechas que se pueden sumar y filtrar.</span>
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => run("pdf")}
            className="flex w-full items-start gap-2.5 border-t border-brand-border px-3 py-2.5 text-left text-sm hover:bg-brand-surface-hover"
          >
            <FileText size={18} className="mt-0.5 shrink-0 text-brand-danger" aria-hidden />
            <span>
              <span className="block font-medium text-brand-text">PDF</span>
              <span className="block text-xs text-brand-muted">Para enviar o imprimir, con la empresa, los filtros y la fecha.</span>
            </span>
          </button>
        </div>
      )}
      <ResultDialog open={!!error} tone="danger" title="No se pudo exportar" onClose={() => setError(null)}>
        <p className="text-sm text-brand-muted">{error}</p>
      </ResultDialog>
    </div>
  );
}
