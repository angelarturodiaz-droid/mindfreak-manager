"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Database, HardDriveDownload, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { ResultDialog } from "@/components/ui/result-dialog";
import { InfoHint } from "@/components/ui/info-hint";
import { formatDateTime } from "@/lib/utils/dates";
import { finishBackupAction, startBackupAction } from "@/features/backups/actions";
import { buildBackupZip, type BackupProgress, type BackupResult } from "@/features/backups/build-zip";

export type BackupRunRow = {
  id: string;
  kind: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  sizeBytes: number | null;
  tableCount: number | null;
  rowCount: number | null;
  fileCount: number | null;
  error: string | null;
  by: string;
};

const STATUS: Record<string, { label: string; cls: string }> = {
  COMPLETADO: { label: "Completada", cls: "bg-brand-success-bg text-brand-success" },
  EN_PROCESO: { label: "En proceso", cls: "bg-brand-info-bg text-brand-accent" },
  FALLIDO: { label: "Falló", cls: "bg-brand-danger-bg text-brand-danger" },
  INCOMPLETO: { label: "Incompleta", cls: "bg-brand-warning-bg text-brand-warning" },
};

function bytes(n: number | null): string {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function BackupPanel({ runs, appVersion, environment }: { runs: BackupRunRow[]; appVersion: string; environment: string }) {
  const router = useRouter();
  const [ask, setAsk] = useState<"FULL" | "DB_ONLY" | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<BackupProgress | null>(null);
  const [result, setResult] = useState<BackupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const last = runs.find((r) => r.status === "COMPLETADO") ?? null;

  async function run(kind: "FULL" | "DB_ONLY") {
    setBusy(true);
    setError(null);
    setResult(null);
    setProgress({ stage: "db", done: 0, total: 1, label: "Confirmando tu código…" });
    const start = await startBackupAction(kind, code);
    if (start.error !== null) {
      setBusy(false);
      setProgress(null);
      setError(start.error);
      return;
    }
    setAsk(null);
    setCode("");
    try {
      const res = await buildBackupZip({ ...start, kind, appVersion, environment }, setProgress);
      await finishBackupAction({
        runId: start.runId, ok: true, sizeBytes: res.sizeBytes, tableCount: res.tableCount, rowCount: res.rowCount,
        fileCount: res.fileCount, manifestSha256: res.manifestSha256, error: null, kind,
      });
      setResult(res);
    } catch (e) {
      const msg = e instanceof Error ? (e.name === "AbortError" ? "Cancelaste dónde guardar el archivo: no se creó la copia." : e.message) : "Error desconocido.";
      await finishBackupAction({
        runId: start.runId, ok: false, sizeBytes: null, tableCount: null, rowCount: null, fileCount: null, manifestSha256: null, error: msg, kind,
      });
      setError(msg);
    } finally {
      setBusy(false);
      setProgress(null);
      router.refresh();
    }
  }

  const pct = progress && progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div className="rounded-[var(--radius-md)] border border-brand-accent/30 bg-brand-info-bg p-4 text-sm text-brand-text">
        <p className="font-medium">¿Para qué sirve?</p>
        <p className="mt-1">
          Descarga a tu computadora <strong>todo el sistema en un solo archivo ZIP</strong>: los datos (clientes, facturas, cobros,
          gastos, bancos, proyectos…), los documentos (PDF, fotos, e-CF de la DGII) y los usuarios. Con él se puede restaurar el sistema
          si un día hay un problema. Hazla <strong>cada semana</strong> y <strong>antes de cualquier cambio grande</strong>.
        </p>
        <p className="mt-2 flex items-start gap-1.5 text-xs text-brand-muted">
          <ShieldCheck size={14} className="mt-0.5 shrink-0 text-brand-accent" aria-hidden />
          Contiene toda la información de la empresa: guárdala en un disco cifrado y en dos lugares. No la envíes por correo ni por
          WhatsApp, ni la subas a nubes personales. No lleva contraseñas ni la verificación en dos pasos de nadie.
        </p>
      </div>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-semibold text-brand-text">
              Última copia completada
              <InfoHint text="La fecha de la última copia que terminó bien. Si es de hace más de una semana, haz una nueva." />
            </p>
            {last ? (
              <p className="mt-1 text-sm text-brand-text">
                {formatDateTime(last.startedAt)} · {last.by} · {last.kind === "FULL" ? "Completa" : "Solo base de datos"} · {bytes(last.sizeBytes)}
              </p>
            ) : (
              <p className="mt-1 text-sm text-brand-warning">Todavía no hay ninguna copia. Haz la primera.</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <Button
              type="button"
              icon={<HardDriveDownload size={15} />}
              disabled={busy}
              onClick={() => setAsk("FULL")}
              hint="Base de datos + todos los documentos en un ZIP. Es la recomendada."
            >
              Crear respaldo completo
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              icon={<Database size={14} />}
              disabled={busy}
              onClick={() => setAsk("DB_ONLY")}
              hint="Solo los datos, sin los archivos. Más rápida; no sirve sola para recuperar los documentos."
            >
              Solo la base de datos
            </Button>
          </div>
        </div>

        {busy && progress && (
          <div className="mt-4 rounded-[var(--radius-md)] bg-brand-surface-hover p-3">
            <p className="flex items-center gap-2 text-sm text-brand-text">
              <Loader2 size={15} className="animate-spin" aria-hidden /> {progress.label}
            </p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-brand-border">
              <div className="h-full bg-brand-accent transition-all" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1 text-xs text-brand-muted">
              {progress.stage === "db" ? "Base de datos" : progress.stage === "files" ? "Documentos" : "Archivo"} · {progress.done} de {progress.total}.
              No cierres esta ventana hasta que termine.
            </p>
          </div>
        )}
      </Card>

      <Card>
        <p className="mb-3 text-sm font-semibold text-brand-text">Últimas copias</p>
        {runs.length === 0 ? (
          <p className="text-sm text-brand-muted">Sin copias todavía.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-brand-muted">
                  <th className="py-2 pr-3">Fecha</th>
                  <th className="py-2 pr-3">Quién</th>
                  <th className="py-2 pr-3">Tipo</th>
                  <th className="py-2 pr-3">Contenido</th>
                  <th className="py-2 pr-3 text-right">Tamaño</th>
                  <th className="py-2">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border">
                {runs.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2 pr-3 whitespace-nowrap">{formatDateTime(r.startedAt)}</td>
                    <td className="py-2 pr-3">{r.by}</td>
                    <td className="py-2 pr-3">{r.kind === "FULL" ? "Completa" : "Solo base de datos"}</td>
                    <td className="py-2 pr-3 text-xs text-brand-muted">
                      {r.tableCount != null ? `${r.tableCount} tablas · ${r.rowCount ?? 0} filas` : "—"}
                      {r.fileCount ? ` · ${r.fileCount} documentos` : ""}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">{bytes(r.sizeBytes)}</td>
                    <td className="py-2">
                      <span title={r.error ?? undefined} className={`rounded-full px-2 py-0.5 text-xs ${STATUS[r.status]?.cls ?? ""}`}>
                        {STATUS[r.status]?.label ?? r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-brand-muted">
          Es solo un registro: el archivo no se guarda en el sistema, solo en tu computadora. Restaurar se hace con las instrucciones
          que van dentro del ZIP (LEEME-RESTAURAR.txt).
        </p>
      </Card>

      <Modal open={ask !== null} onClose={() => !busy && setAsk(null)} title={ask === "DB_ONLY" ? "Copia solo de la base de datos" : "Crear respaldo completo"}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (ask) void run(ask);
          }}
          className="flex flex-col gap-3"
        >
          <p className="text-sm text-brand-text">
            Por seguridad, escribe el <strong>código de 6 dígitos</strong> de tu aplicación de verificación (Google Authenticator,
            Authy…). Luego elige dónde guardar el archivo (si tu navegador lo pregunta) y espera a que termine.
          </p>
          <Input
            label="Código de verificación"
            name="mfa_code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.currentTarget.value.replace(/\D/g, ""))}
            placeholder="123456"
          />
          <div className="flex justify-end gap-2 border-t border-brand-border pt-3">
            <Button type="button" variant="outline" onClick={() => setAsk(null)} disabled={busy}>
              Cancelar
            </Button>
            <Button type="submit" loading={busy} disabled={code.length !== 6}>
              Crear la copia
            </Button>
          </div>
        </form>
      </Modal>

      <ResultDialog open={result !== null} tone="success" title="Copia creada" onClose={() => setResult(null)}>
        {result && (
          <div className="flex flex-col gap-1 text-sm text-brand-text">
            <p className="flex items-center gap-1.5">
              <CheckCircle2 size={15} className="text-brand-success" aria-hidden /> Se guardó <strong>{result.fileName}</strong> ({bytes(result.sizeBytes)}).
            </p>
            <p>
              {result.tableCount} tablas · {result.rowCount} filas{result.fileCount ? ` · ${result.fileCount} documentos` : ""}.
            </p>
            {result.skipped.length > 0 && (
              <div className="mt-1 rounded-[var(--radius-md)] bg-brand-warning-bg px-3 py-2 text-xs text-brand-text">
                <p className="font-medium">
                  {result.skipped.length} documento(s) no se pudieron bajar (quedan anotados en la copia):
                </p>
                <ul className="mt-1 list-disc pl-4">
                  {result.skipped.slice(0, 5).map((s) => (
                    <li key={s.path}>
                      {s.path.split("/").pop()} — {s.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-xs text-brand-muted">Muévela a un disco cifrado y guarda una segunda copia en otro lugar.</p>
          </div>
        )}
      </ResultDialog>
      <ResultDialog open={error !== null} tone="danger" title="No se pudo crear la copia" onClose={() => setError(null)}>
        <p className="flex items-start gap-1.5 text-sm text-brand-text">
          <XCircle size={15} className="mt-0.5 shrink-0 text-brand-danger" aria-hidden /> {error}
        </p>
        <p className="mt-2 flex items-start gap-1.5 text-xs text-brand-muted">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden /> No se cambió ni se borró nada en el sistema.
        </p>
      </ResultDialog>
    </div>
  );
}
