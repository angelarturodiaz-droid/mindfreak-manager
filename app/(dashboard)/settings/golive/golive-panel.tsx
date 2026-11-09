"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Eraser, Eye, Flag, Loader2, RefreshCw, ShieldAlert, ShieldCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { ResultDialog } from "@/components/ui/result-dialog";
import { InfoHint } from "@/components/ui/info-hint";
import { formatDateTime } from "@/lib/utils/dates";
import {
  goLiveDeclareAction,
  goLiveExecuteAction,
  goLivePreviewAction,
  goLiveRetryFilesAction,
  goLiveValidateAction,
} from "@/features/golive/actions";
import { CHECK_LABELS, KEPT_LABELS, type GoLiveChecks, type GoLivePreview } from "@/features/golive/types";

export type GoLiveRunRow = {
  id: string;
  status: string;
  createdAt: string;
  finishedAt: string | null;
  records: number;
  files: number;
  filesLeft: number;
  by: string;
};

const DAY = 24 * 60 * 60 * 1000;
const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase() && b.trim() !== "";

export function GoLivePanel({
  environment,
  goLiveAt,
  locked,
  lastBackupAt,
  companyName,
  runs,
}: {
  environment: string;
  goLiveAt: string | null;
  locked: boolean;
  lastBackupAt: string | null;
  companyName: string;
  runs: GoLiveRunRow[];
}) {
  const router = useRouter();
  const [ask, setAsk] = useState<"preview" | "execute" | "declare" | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<GoLivePreview | null>(null);
  const [checks, setChecks] = useState<GoLiveChecks | null>(null);
  const [done, setDone] = useState<{ records: number; files: number; left: number } | null>(null);
  const [declared, setDeclared] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // eslint-disable-next-line react-hooks/purity -- la hora solo decide un aviso; se recalcula en cada visita.
  const backupFresh = lastBackupAt != null && Date.now() - new Date(lastBackupAt).getTime() < DAY;
  const lastRun = runs[0] ?? null;
  const isProd = environment === "PRODUCTION";

  function close() {
    if (busy) return;
    setAsk(null);
    setCode("");
    setName("");
  }

  async function doPreview() {
    setBusy(true);
    const res = await goLivePreviewAction(code);
    setBusy(false);
    if (res.error !== null) return setError(res.error);
    setPreview(res.preview);
    setChecks(null);
    setAsk(null);
    setCode("");
  }

  async function doExecute() {
    if (!preview) return;
    setBusy(true);
    const res = await goLiveExecuteAction(preview.previewId, name);
    setBusy(false);
    if (res.error !== null) return setError(res.error);
    setAsk(null);
    setName("");
    setDone({ records: preview.total, files: res.filesTotal, left: res.filesLeft });
    setPreview(null);
    router.refresh();
  }

  async function doValidate() {
    setBusy(true);
    const res = await goLiveValidateAction();
    setBusy(false);
    if (res.error !== null) return setError(res.error);
    setChecks(res.checks);
  }

  async function doRetry() {
    if (!lastRun) return;
    setBusy(true);
    const res = await goLiveRetryFilesAction(lastRun.id);
    setBusy(false);
    if (res.error) return setError(res.error);
    router.refresh();
    if (res.filesLeft > 0) setError(`Todavía quedan ${res.filesLeft} archivo(s). Revisa tu conexión y reintenta.`);
  }

  async function doDeclare() {
    setBusy(true);
    const res = await goLiveDeclareAction(code, name);
    setBusy(false);
    if (res.error) return setError(res.error);
    setAsk(null);
    setCode("");
    setName("");
    setDeclared(true);
    router.refresh();
  }

  if (locked || goLiveAt) {
    return (
      <div className="flex max-w-4xl flex-col gap-6">
        <div className="rounded-[var(--radius-md)] border border-brand-success/30 bg-brand-success-bg p-4 text-sm text-brand-text">
          <p className="flex items-center gap-2 font-medium">
            <Flag size={16} className="text-brand-success" aria-hidden /> Go-Live declarado {goLiveAt ? `el ${formatDateTime(goLiveAt)}` : ""}
          </p>
          <p className="mt-1">
            El sistema ya trabaja con los datos reales. La limpieza quedó <strong>bloqueada para siempre</strong>: ningún dato
            financiero se puede borrar. Para corregir un error se usa <strong>Anular</strong> o <strong>Corregir</strong>, y todo queda
            en la Auditoría.
          </p>
        </div>
        <RunsCard runs={runs} />
        <ResultDialog open={declared} tone="success" title="¡Go-Live declarado!" onClose={() => setDeclared(false)}>
          <p>Desde ahora el sistema lleva los datos reales de la empresa. Haz un respaldo completo hoy mismo.</p>
        </ResultDialog>
      </div>
    );
  }

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div className="rounded-[var(--radius-md)] border border-brand-warning/40 bg-brand-warning-bg p-4 text-sm text-brand-text">
        <p className="flex items-center gap-2 font-medium">
          <ShieldAlert size={16} className="text-brand-warning" aria-hidden /> ¿Para qué sirve?
        </p>
        <p className="mt-1">
          Antes de empezar a usar el sistema con los datos reales, <strong>borra todo lo que se creó en las pruebas</strong>: facturas,
          cotizaciones, proyectos, gastos, cobros, pagos, movimientos de banco, clientes, proveedores, cuentas de prueba y sus documentos.
          <strong> La configuración se conserva</strong>: usuarios, permisos, impuestos, reglas fiscales, categorías, productos y servicios,
          Directorio (lo que no es proveedor) y Activos.
        </p>
        <p className="mt-2 text-xs text-brand-muted">
          Se hace una sola vez, en la Fase 5 del plan (después de que el contador confirme las reglas fiscales). Se puede repetir mientras
          no declares el Go-Live. Si algo sale mal, se recupera todo con el respaldo completo del día.
        </p>
      </div>

      <Card>
        <p className="mb-3 text-sm font-semibold text-brand-text">Antes de empezar</p>
        <ul className="flex flex-col gap-2 text-sm">
          <li className="flex items-start gap-2">
            {isProd ? <CheckCircle2 size={16} className="mt-0.5 text-brand-success" /> : <XCircle size={16} className="mt-0.5 text-brand-danger" />}
            <span>
              Esta base es la de <strong>{isProd ? "producción" : "desarrollo"}</strong>.
              <InfoHint text="La limpieza solo existe en la base de producción y solo hasta declarar el Go-Live." />
            </span>
          </li>
          <li className="flex items-start gap-2">
            {backupFresh ? <CheckCircle2 size={16} className="mt-0.5 text-brand-success" /> : <XCircle size={16} className="mt-0.5 text-brand-danger" />}
            <span>
              Respaldo completo de las últimas 24 horas:{" "}
              {lastBackupAt ? <strong>{formatDateTime(lastBackupAt)}</strong> : <strong>ninguno</strong>}.
              {!backupFresh && (
                <>
                  {" "}
                  <Link href="/settings/backups" className="text-brand-accent underline">
                    Créalo en Copias de seguridad
                  </Link>{" "}
                  y guarda el ZIP en dos lugares.
                </>
              )}
              <InfoHint text="Es la red de seguridad: con ese ZIP se puede volver a como estaba antes de limpiar." />
            </span>
          </li>
        </ul>
      </Card>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-semibold text-brand-text">
              Paso 1 · Ver qué se borraría
              <InfoHint text="No borra nada. Cuenta lo que se eliminaría y lo que se conserva. Vale 30 minutos." />
            </p>
            <p className="mt-1 text-sm text-brand-muted">Revisa la lista con calma antes de borrar.</p>
          </div>
          <Button type="button" icon={<Eye size={15} />} disabled={busy || !isProd} onClick={() => setAsk("preview")}>
            Ver vista previa
          </Button>
        </div>

        {preview && <PreviewDetail preview={preview} />}

        {preview && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-brand-border pt-4">
            {preview.backupOk ? (
              <p className="text-sm text-brand-muted">Si todo está bien, sigue con el paso 2.</p>
            ) : (
              <p className="text-sm text-brand-danger">Falta el respaldo completo de las últimas 24 horas: créalo antes de borrar.</p>
            )}
            <Button
              type="button"
              variant="danger"
              icon={<Eraser size={15} />}
              disabled={busy || !preview.backupOk}
              onClick={() => setAsk("execute")}
              hint="Borra todo lo de la lista. Pide escribir el nombre de la empresa."
            >
              Paso 2 · Borrar los datos de prueba
            </Button>
          </div>
        )}
      </Card>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-semibold text-brand-text">
              Paso 3 · Comprobar la limpieza
              <InfoHint text="Revisa solo que todo quedó en cero, que no quedó nada suelto y que la configuración no cambió." />
            </p>
            <p className="mt-1 text-sm text-brand-muted">
              {lastRun ? `Última limpieza: ${formatDateTime(lastRun.createdAt)} por ${lastRun.by}.` : "Todavía no se ha hecho ninguna limpieza."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {lastRun?.status === "STORAGE_PENDING" && (
              <Button type="button" variant="outline" icon={<RefreshCw size={14} />} disabled={busy} onClick={doRetry}>
                Reintentar archivos ({lastRun.filesLeft})
              </Button>
            )}
            <Button type="button" variant="outline" icon={<ShieldCheck size={15} />} disabled={busy || !lastRun} onClick={doValidate}>
              Comprobar ahora
            </Button>
          </div>
        </div>
        {checks?.ran && (
          <ul className="mt-4 flex flex-col gap-2">
            {checks.checks.map((c) => {
              const l = CHECK_LABELS[c.key];
              return (
                <li key={c.key} className="flex items-start gap-2 text-sm">
                  {c.ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-brand-success" /> : <XCircle size={16} className="mt-0.5 shrink-0 text-brand-danger" />}
                  <span>
                    <strong>{l?.title ?? c.key}.</strong> <span className="text-brand-muted">{c.ok ? l?.ok : l?.bad}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-semibold text-brand-text">
              Paso 4 · Declarar Go-Live
              <InfoHint text="Se hace el día del arranque, cuando ya cargaste los datos reales (cuentas con su saldo inicial, clientes y proveedores). Bloquea la limpieza para siempre." />
            </p>
            <p className="mt-1 text-sm text-brand-muted">
              Después de esto ya no se puede borrar nada: las correcciones se hacen con anulaciones.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            icon={<Flag size={15} />}
            disabled={busy || lastRun?.status !== "DONE"}
            onClick={() => setAsk("declare")}
            hint={lastRun?.status === "DONE" ? "Pide tu código y el nombre de la empresa." : "Primero haz la limpieza completa (pasos 1 y 2)."}
          >
            Declarar Go-Live
          </Button>
        </div>
      </Card>

      <RunsCard runs={runs} />

      <Modal open={ask === "preview"} onClose={close} title="Ver vista previa">
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void doPreview();
          }}
        >
          <p className="text-sm text-brand-text">
            Por seguridad, escribe el <strong>código de 6 dígitos</strong> de tu aplicación de verificación. La vista previa no borra nada.
          </p>
          <CodeInput code={code} setCode={setCode} />
          <ModalButtons busy={busy} onCancel={close} disabled={code.length !== 6} label="Ver" />
        </form>
      </Modal>

      <Modal open={ask === "execute"} onClose={close} title="Borrar los datos de prueba">
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void doExecute();
          }}
        >
          <p className="text-sm text-brand-text">
            Se borrarán <strong>{preview?.total ?? 0} registros</strong> y <strong>{preview?.fileCount ?? 0} archivos</strong>. Desde la
            aplicación no se puede deshacer: solo se recupera con el respaldo completo.
          </p>
          <Input
            label={`Para confirmar, escribe «${companyName}»`}
            name="company_name"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            autoComplete="off"
          />
          {busy && (
            <p className="flex items-center gap-2 text-sm text-brand-muted">
              <Loader2 size={14} className="animate-spin" aria-hidden /> Borrando… no cierres esta ventana.
            </p>
          )}
          <ModalButtons busy={busy} onCancel={close} disabled={!sameName(companyName, name)} label="Borrar ahora" danger />
        </form>
      </Modal>

      <Modal open={ask === "declare"} onClose={close} title="Declarar Go-Live">
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void doDeclare();
          }}
        >
          <p className="text-sm text-brand-text">
            Desde este momento el sistema lleva los <strong>datos reales</strong>. La limpieza se bloquea para siempre y esta pantalla
            queda solo como registro. Hazlo cuando ya cargaste los saldos iniciales, los clientes y los proveedores reales.
          </p>
          <CodeInput code={code} setCode={setCode} />
          <Input
            label={`Escribe «${companyName}»`}
            name="company_name_declare"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            autoComplete="off"
          />
          <ModalButtons busy={busy} onCancel={close} disabled={code.length !== 6 || !sameName(companyName, name)} label="Declarar Go-Live" danger />
        </form>
      </Modal>

      <ResultDialog open={done !== null} tone={done && done.left > 0 ? "warning" : "success"} title="Limpieza hecha" onClose={() => setDone(null)}>
        {done && (
          <>
            <p>
              Se borraron {done.records} registros y {done.files - done.left} de {done.files} archivos.
            </p>
            {done.left > 0 && <p>Quedaron {done.left} archivo(s): pulsa «Reintentar archivos» en el paso 3.</p>}
            <p>Ahora pulsa «Comprobar ahora» (paso 3).</p>
          </>
        )}
      </ResultDialog>

      <ResultDialog open={error !== null} tone="danger" title="No se pudo completar" onClose={() => setError(null)}>
        <p>{error}</p>
      </ResultDialog>
    </div>
  );
}

function PreviewDetail({ preview }: { preview: GoLivePreview }) {
  const rows = preview.counts.filter((c) => c.count > 0);
  const lists: [string, string[]][] = [
    ["Clientes", preview.lists.clients],
    ["Proveedores", preview.lists.suppliers],
    ["Cuentas de banco y tarjetas", preview.lists.bankAccounts],
    ["Activos", preview.lists.assets],
  ];
  return (
    <div className="mt-4 grid gap-4 md:grid-cols-2">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase text-brand-danger">Se borra</p>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-brand-border">
            {rows.map((c) => (
              <tr key={c.key}>
                <td className="py-1.5 pr-3">{c.label}</td>
                <td className="py-1.5 text-right tabular-nums">{c.count}</td>
              </tr>
            ))}
            <tr>
              <td className="py-1.5 pr-3">Archivos (PDF, fotos, adjuntos)</td>
              <td className="py-1.5 text-right tabular-nums">{preview.fileCount}</td>
            </tr>
          </tbody>
        </table>
        {lists.map(([label, names]) =>
          names.length ? (
            <p key={label} className="mt-2 text-xs text-brand-muted">
              <strong className="text-brand-text">{label}:</strong> {names.join(" · ")}
            </p>
          ) : null,
        )}
      </div>
      <div>
        <p className="mb-2 text-xs font-semibold uppercase text-brand-success">Se conserva</p>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-brand-border">
            {Object.entries(KEPT_LABELS).map(([k, label]) => (
              <tr key={k}>
                <td className="py-1.5 pr-3">{label}</td>
                <td className="py-1.5 text-right tabular-nums">{preview.kept[k] ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-brand-muted">
          También: datos de la empresa y logo, permisos, mensajes al cliente, recordatorios, carta de retención y el historial de
          copias de seguridad. La numeración (FAC, COT, PROY, ACU, ANT, CR) vuelve a empezar en 0001.
        </p>
      </div>
    </div>
  );
}

function RunsCard({ runs }: { runs: GoLiveRunRow[] }) {
  if (runs.length === 0) return null;
  return (
    <Card>
      <p className="mb-3 text-sm font-semibold text-brand-text">Limpiezas hechas</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-brand-muted">
              <th className="py-2 pr-3">Fecha</th>
              <th className="py-2 pr-3">Quién</th>
              <th className="py-2 pr-3 text-right">Registros</th>
              <th className="py-2 pr-3 text-right">Archivos</th>
              <th className="py-2">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-border">
            {runs.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap py-2 pr-3">{formatDateTime(r.createdAt)}</td>
                <td className="py-2 pr-3">{r.by}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{r.records}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{r.files - r.filesLeft} de {r.files}</td>
                <td className="py-2">
                  {r.status === "DONE" ? (
                    <span className="rounded-full bg-brand-success-bg px-2 py-0.5 text-xs text-brand-success">Completa</span>
                  ) : (
                    <span className="rounded-full bg-brand-warning-bg px-2 py-0.5 text-xs text-brand-warning">Faltan archivos</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function CodeInput({ code, setCode }: { code: string; setCode: (v: string) => void }) {
  return (
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
  );
}

function ModalButtons({ busy, onCancel, disabled, label, danger }: { busy: boolean; onCancel: () => void; disabled: boolean; label: string; danger?: boolean }) {
  return (
    <div className="flex justify-end gap-2 border-t border-brand-border pt-3">
      <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
        Cancelar
      </Button>
      <Button type="submit" variant={danger ? "danger" : "primary"} loading={busy} disabled={disabled}>
        {label}
      </Button>
    </div>
  );
}
