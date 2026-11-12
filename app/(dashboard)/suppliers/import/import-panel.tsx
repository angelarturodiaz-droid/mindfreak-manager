"use client";

import { useRef, useState } from "react";
import { CheckCircle2, Download, FileSpreadsheet, TriangleAlert, Upload, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ResultDialog } from "@/components/ui/result-dialog";
import { InfoHint } from "@/components/ui/info-hint";
import { buildWorkbook, readSheet, WorkbookReadError } from "@/lib/xlsx/workbook";
import {
  SUPPLIER_IMPORT_SHEET,
  supplierErrorSheets,
  supplierTemplateSheets,
  type SupplierImportRow,
} from "@/features/suppliers/import";
import {
  commitSupplierImportAction,
  getSupplierTemplateDataAction,
  previewSupplierImportAction,
} from "@/features/suppliers/import-actions";

const PAGE = 10;
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function download(bytes: Uint8Array, name: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: XLSX_MIME }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

const STATUS = {
  ok: { label: "Lista", tone: "success" as const, icon: CheckCircle2 },
  warn: { label: "Con aviso", tone: "warning" as const, icon: TriangleAlert },
  error: { label: "Error", tone: "danger" as const, icon: XCircle },
};

/**
 * A3 — Proveedores → Importar. 1) Descargar la plantilla (con tus categorías, tipos de servicio y bancos).
 * 2) Subir el Excel → «Revisar archivo» (no guarda nada). 3) «Importar» las filas sin errores. 4) Descargar las que
 * fallaron con el motivo, corregirlas y volver a subirlas.
 */
export function SupplierImportPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"template" | "read" | "import" | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<string[][] | null>(null);
  const [results, setResults] = useState<SupplierImportRow[] | null>(null);
  const [filter, setFilter] = useState<"all" | "ok" | "warn" | "error">("all");
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState(false);
  const [done, setDone] = useState<{ imported: number; errors: SupplierImportRow[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const counts = {
    ok: results?.filter((r) => r.status === "ok").length ?? 0,
    warn: results?.filter((r) => r.status === "warn").length ?? 0,
    error: results?.filter((r) => r.status === "error").length ?? 0,
  };
  const importable = counts.ok + counts.warn;
  const shown = (results ?? []).filter((r) => filter === "all" || r.status === filter);
  const pages = Math.max(1, Math.ceil(shown.length / PAGE));
  const pageRows = shown.slice((page - 1) * PAGE, page * PAGE);

  async function downloadTemplate() {
    setBusy("template");
    const res = await getSupplierTemplateDataAction();
    setBusy(null);
    if (res.error !== null) return setError(res.error);
    download(buildWorkbook(supplierTemplateSheets(res.catalogs)), "plantilla-proveedores.xlsx");
  }

  function reset() {
    setFileName(null);
    setRows(null);
    setResults(null);
    setFilter("all");
    setPage(1);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (!/\.xlsx$/i.test(file.name)) {
      reset();
      return setError("Sube el archivo en formato Excel (.xlsx). Si lo tienes en otro formato, ábrelo en Excel y usa «Guardar como» → «Libro de Excel (.xlsx)».");
    }
    if (file.size > 10 * 1024 * 1024) {
      reset();
      return setError("El archivo pesa más de 10 MB. Revisa que sea la plantilla y que no tenga imágenes.");
    }
    setBusy("read");
    try {
      const { rows: data } = readSheet(new Uint8Array(await file.arrayBuffer()), SUPPLIER_IMPORT_SHEET);
      const res = await previewSupplierImportAction(data);
      if (res.error !== null) {
        reset();
        setError(res.error);
      } else {
        setFileName(file.name);
        setRows(data);
        setResults(res.results);
        setFilter(res.results.some((r) => r.status === "error") ? "error" : "all");
        setPage(1);
      }
    } catch (e) {
      reset();
      setError(e instanceof WorkbookReadError ? e.message : "No se pudo leer el archivo. Revisa que sea un Excel (.xlsx) válido.");
    } finally {
      setBusy(null);
    }
  }

  async function doImport() {
    if (!rows || !fileName) return;
    setBusy("import");
    const res = await commitSupplierImportAction(rows, fileName);
    setBusy(null);
    setConfirm(false);
    if (res.error !== null) return setError(res.error);
    const failedRows = new Set(res.failed.map((f) => f.row));
    const errors = [
      ...res.skipped,
      ...(results ?? [])
        .filter((r) => failedRows.has(r.row))
        .map((r) => ({ ...r, messages: [{ level: "error" as const, text: res.failed.find((f) => f.row === r.row)?.error ?? "No se pudo guardar." }] })),
    ].sort((a, b) => a.row - b.row);
    setDone({ imported: res.imported, errors });
    reset();
  }

  function downloadErrors(list: SupplierImportRow[]) {
    download(buildWorkbook(supplierErrorSheets(list)), "proveedores-con-error.xlsx");
  }

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-2xl">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-brand-text">
              1 · Descarga la plantilla
              <InfoHint text="Trae tus categorías, tipos de servicio y bancos actuales en listas desplegables, las instrucciones y ejemplos. Descárgala de nuevo si cambias los catálogos." />
            </p>
            <p className="mt-1 text-sm text-brand-muted">
              Llena la hoja <strong>«Proveedores»</strong> desde la fila 2, un proveedor por fila. Solo el <strong>nombre</strong> es
              obligatorio, pero con el tipo de proveedor, la condición fiscal y el tipo de servicio sus gastos se clasifican solos.
            </p>
          </div>
          <Button type="button" variant="outline" icon={<Download size={15} />} loading={busy === "template"} disabled={busy !== null} onClick={downloadTemplate}>
            Descargar plantilla
          </Button>
        </div>
      </Card>

      <Card className="flex flex-col gap-3">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-brand-text">
          2 · Sube el Excel lleno
          <InfoHint text="El sistema revisa cada fila y te muestra qué está listo, qué tiene avisos y qué tiene errores. Todavía no se guarda nada." />
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => onFile(e.currentTarget.files?.[0])}
          />
          <Button type="button" icon={<Upload size={15} />} loading={busy === "read"} disabled={busy !== null} onClick={() => inputRef.current?.click()}>
            {fileName ? "Elegir otro archivo" : "Elegir archivo y revisar"}
          </Button>
          {fileName && (
            <span className="inline-flex items-center gap-1.5 text-sm text-brand-muted">
              <FileSpreadsheet size={15} aria-hidden /> {fileName}
            </span>
          )}
        </div>

        {results && (
          <>
            <div className="flex flex-wrap items-center gap-2 border-t border-brand-border pt-3 text-sm">
              {(
                [
                  ["all", `Todas (${results.length})`],
                  ["ok", `Listas (${counts.ok})`],
                  ["warn", `Con aviso (${counts.warn})`],
                  ["error", `Con error (${counts.error})`],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    setFilter(k);
                    setPage(1);
                  }}
                  className={`rounded-full px-3 py-1 ${filter === k ? "bg-brand-primary text-white" : "bg-brand-surface-hover text-brand-text hover:bg-brand-border"}`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-brand-muted">
                    <th className="py-2 pr-3">Fila</th>
                    <th className="py-2 pr-3">Nombre</th>
                    <th className="py-2 pr-3">Estado</th>
                    <th className="py-2">Detalle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border">
                  {pageRows.map((r) => {
                    const st = STATUS[r.status];
                    return (
                      <tr key={r.row} className="align-top">
                        <td className="py-2 pr-3 tabular-nums text-brand-muted">{r.row}</td>
                        <td className="py-2 pr-3 font-medium text-brand-text">{r.name || <span className="text-brand-muted">(sin nombre)</span>}</td>
                        <td className="py-2 pr-3">
                          <Badge tone={st.tone}>{st.label}</Badge>
                        </td>
                        <td className="py-2">
                          {r.messages.length === 0 ? (
                            <span className="text-brand-muted">Todo bien.</span>
                          ) : (
                            <ul className="flex flex-col gap-0.5">
                              {r.messages.map((m, i) => (
                                <li key={i} className={m.level === "error" ? "text-brand-danger" : "text-brand-text"}>
                                  {m.level === "error" ? "✕ " : "⚠ "}
                                  {m.text}
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {pageRows.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-brand-muted">
                        No hay filas en este grupo.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {pages > 1 && (
              <div className="flex items-center justify-end gap-2 text-sm">
                <Button type="button" size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>
                  Anterior
                </Button>
                <span className="text-brand-muted">
                  Página {page} de {pages}
                </span>
                <Button type="button" size="sm" variant="outline" disabled={page === pages} onClick={() => setPage(page + 1)}>
                  Siguiente
                </Button>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-brand-border pt-3">
              <p className="text-sm text-brand-muted">
                {importable > 0 ? (
                  <>
                    Se importarán <strong className="text-brand-text">{importable}</strong> proveedor(es)
                    {counts.error > 0 && <> · {counts.error} con error no se importan</>}.
                  </>
                ) : (
                  "Ninguna fila se puede importar todavía: corrige los errores y vuelve a subir el archivo."
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                {counts.error > 0 && (
                  <Button type="button" variant="outline" icon={<Download size={15} />} onClick={() => downloadErrors(results.filter((r) => r.status === "error"))}>
                    Descargar filas con error
                  </Button>
                )}
                <Button type="button" icon={<CheckCircle2 size={15} />} disabled={importable === 0 || busy !== null} onClick={() => setConfirm(true)}>
                  3 · Importar {importable} proveedor(es)
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>

      <ResultDialog
        open={confirm}
        tone="warning"
        title="¿Importar los proveedores?"
        onClose={() => busy === null && setConfirm(false)}
        actions={
          <div className="flex w-full justify-center gap-2">
            <Button type="button" variant="outline" disabled={busy !== null} onClick={() => setConfirm(false)}>
              Cancelar
            </Button>
            <Button type="button" loading={busy === "import"} onClick={doImport} data-autofocus>
              Importar
            </Button>
          </div>
        }
      >
        <p>
          Se crearán <strong>{importable}</strong> proveedor(es){counts.warn > 0 && <> ({counts.warn} con avisos para completar después)</>}.
          {counts.error > 0 && <> Las {counts.error} fila(s) con error no se importan.</>}
        </p>
      </ResultDialog>

      <ResultDialog
        open={done !== null}
        tone={done && done.errors.length > 0 ? "warning" : "success"}
        title="Importación terminada"
        onClose={() => setDone(null)}
        actions={
          done && done.errors.length > 0 ? (
            <div className="flex w-full justify-center gap-2">
              <Button type="button" variant="outline" icon={<Download size={15} />} onClick={() => downloadErrors(done.errors)}>
                Filas con error
              </Button>
              <Button type="button" onClick={() => setDone(null)} data-autofocus>
                Cerrar
              </Button>
            </div>
          ) : undefined
        }
      >
        {done && (
          <>
            <p>
              Se importaron <strong>{done.imported}</strong> proveedor(es).
            </p>
            {done.errors.length > 0 && (
              <p>
                {done.errors.length} fila(s) no se importaron. Descárgalas con el motivo, corrígelas y vuelve a subir ese archivo.
              </p>
            )}
          </>
        )}
      </ResultDialog>

      <ResultDialog open={error !== null} tone="danger" title="No se pudo completar" onClose={() => setError(null)}>
        <p>{error}</p>
      </ResultDialog>
    </div>
  );
}
