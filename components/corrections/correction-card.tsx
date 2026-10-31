"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ArrowRight, Ban, Check, PencilLine, Undo2, X } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { ResultDialog } from "@/components/ui/result-dialog";
import { InfoHint } from "@/components/ui/info-hint";
import {
  approveCorrectionAction,
  rejectCorrectionAction,
  withdrawCorrectionAction,
  type CorrectionResult,
} from "@/features/corrections/actions";
import type { CorrectionRow } from "@/features/corrections/queries";
import {
  FIELD_LABELS,
  STATUS_INFO,
  STATUS_LABELS,
  STATUS_TONES,
  TARGET_LABELS,
  whatWillHappen,
} from "@/features/corrections/schema";
import { formatMoney } from "@/lib/utils/money";
import { formatDate, formatDateTime } from "@/lib/utils/dates";

const TONE_CLASSES = {
  warning: "bg-brand-warning-bg text-brand-warning",
  success: "bg-brand-success-bg text-brand-success",
  danger: "bg-brand-danger-bg text-brand-danger",
  neutral: "bg-brand-surface-hover text-brand-muted",
};

function linkHref(r: CorrectionRow): string | null {
  if (!r.link_id) return null;
  if (r.link_type === "invoice") return `/invoices/${r.link_id}`;
  if (r.link_type === "expense") return `/expenses/${r.link_id}`;
  if (r.link_type === "bank_account") return `/banks/${r.link_id}`;
  return null;
}

function show(field: string, value: unknown, values: Record<string, unknown>): string {
  if (value === null || value === undefined || value === "") return "—";
  if (field === "amount") return formatMoney(Number(value), String(values.currency ?? "DOP"));
  if (field === "date") return formatDate(String(value));
  if (field === "bank_account_id") return String(values.bank_account_name ?? "otra cuenta");
  return String(value);
}

/** Una solicitud de corrección con su antes/después y las acciones que tocan. */
export function CorrectionCard({
  row,
  currentUserId,
  canApprove,
}: {
  row: CorrectionRow;
  currentUserId: string;
  canApprove: boolean;
}) {
  const [dialog, setDialog] = useState<"approve" | "reject" | null>(null);
  const [note, setNote] = useState("");
  const [result, setResult] = useState<{ ok: boolean; text: string; title: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const mine = row.requested_by === currentUserId;
  const isPending = row.status === "PENDING";
  const href = linkHref(row);
  const fields = Object.keys(row.new_values).filter((k) => k !== "bank_account_name");
  const changed = {
    amount: "amount" in row.new_values,
    account: "bank_account_id" in row.new_values,
    date: "date" in row.new_values,
    reference: "reference" in row.new_values,
    description: "description" in row.new_values,
  };

  function run(fn: () => Promise<CorrectionResult>, okTitle: string) {
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        setDialog(null);
        setNote("");
      }
      setResult({ ok: res.ok, text: res.message, title: res.ok ? okTitle : "No se pudo completar" });
    });
  }

  return (
    <article
      className={`rounded-[var(--radius-lg)] border bg-brand-surface p-4 ${
        isPending ? "border-brand-warning/40" : "border-brand-border"
      }`}
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-xs text-brand-muted">
            <span className="rounded-full bg-brand-surface-hover px-2 py-0.5">{TARGET_LABELS[row.target_type]}</span>
            {row.action === "VOID" ? (
              <span className="inline-flex items-center gap-1 font-medium text-brand-danger">
                <Ban size={12} aria-hidden /> Anular
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 font-medium text-brand-accent">
                <PencilLine size={12} aria-hidden /> Corregir datos
              </span>
            )}
          </p>
          <p className="mt-1 font-semibold text-brand-text">
            {href ? (
              <Link href={href} className="hover:text-brand-accent hover:underline">
                {row.target_label}
              </Link>
            ) : (
              row.target_label
            )}
          </p>
        </div>
        <span className="flex items-center gap-1">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TONE_CLASSES[STATUS_TONES[row.status]]}`}>
            {STATUS_LABELS[row.status]}
          </span>
          <InfoHint text={STATUS_INFO[row.status]} />
        </span>
      </header>

      {row.action === "VOID" ? (
        <p className="mt-3 rounded-[var(--radius-md)] bg-brand-danger-bg px-3 py-2 text-sm text-brand-text">
          Se anula completo: {show("amount", row.old_values.amount, row.old_values)} del{" "}
          {show("date", row.old_values.date, row.old_values)} en {String(row.old_values.bank_account_name ?? "—")}.
        </p>
      ) : (
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-brand-muted">
              <th className="py-1 font-medium">Dato</th>
              <th className="py-1 font-medium">Antes</th>
              <th className="py-1" />
              <th className="py-1 font-medium">Después</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((f) => (
              <tr key={f} className="border-t border-brand-border">
                <td className="py-1.5 text-brand-muted">{FIELD_LABELS[f] ?? f}</td>
                <td className="py-1.5 text-brand-muted line-through">{show(f, row.old_values[f], row.old_values)}</td>
                <td className="py-1.5 text-brand-muted">
                  <ArrowRight size={13} aria-hidden />
                </td>
                <td className="py-1.5 font-medium text-brand-text">
                  {show(f, row.new_values[f], { ...row.old_values, ...row.new_values })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="mt-3 text-sm text-brand-text">
        <span className="text-brand-muted">Motivo:</span> {row.reason}
      </p>
      <p className="mt-1 text-xs text-brand-muted">
        Pidió <strong className="text-brand-text">{row.requesterName}</strong> · {formatDateTime(row.requested_at)}
        {row.decided_at && row.status !== "WITHDRAWN" && (
          <>
            {" "}
            · {row.status === "APPROVED" ? "aprobó" : "rechazó"}{" "}
            <strong className="text-brand-text">{row.deciderName}</strong> · {formatDateTime(row.decided_at)}
          </>
        )}
        {row.status === "WITHDRAWN" && row.decided_at && <> · retirada {formatDateTime(row.decided_at)}</>}
      </p>
      {row.decision_note && (
        <p className="mt-1 text-xs text-brand-text">
          <span className="text-brand-muted">Nota de la decisión:</span> {row.decision_note}
        </p>
      )}

      {isPending && (
        <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-brand-border pt-3">
          {mine ? (
            <>
              <span className="mr-auto text-xs text-brand-muted">
                La pediste tú: debe aprobarla otra persona de Administración o Finanzas.
              </span>
              <Button
                variant="outline"
                size="sm"
                icon={<Undo2 size={13} />}
                loading={pending}
                onClick={() => run(() => withdrawCorrectionAction(row.id), "Solicitud retirada")}
                hint="Si ya no hace falta. No cambia nada."
              >
                Retirar
              </Button>
            </>
          ) : canApprove ? (
            <>
              <Button variant="outline" size="sm" icon={<X size={13} />} onClick={() => setDialog("reject")} hint="No se aplica; debes explicar por qué.">
                Rechazar
              </Button>
              <Button size="sm" icon={<Check size={13} />} onClick={() => setDialog("approve")} hint="Revisa el antes y el después; al aprobar se aplica de inmediato.">
                Aprobar
              </Button>
            </>
          ) : (
            <span className="text-xs text-brand-muted">Esperando a Administración o Finanzas.</span>
          )}
        </div>
      )}

      <Modal
        open={dialog === "approve"}
        onClose={() => !pending && setDialog(null)}
        title={row.action === "VOID" ? "¿Aprobar la anulación?" : "¿Aprobar la corrección?"}
      >
        <div className="flex flex-col gap-3 text-sm">
          <p className="font-medium text-brand-text">{row.target_label}</p>
          <ul className="list-disc space-y-0.5 pl-5 text-xs text-brand-text">
            {whatWillHappen(row.target_type, row.action, changed)
              .slice(1)
              .map((s) => (
                <li key={s}>{s}</li>
              ))}
          </ul>
          <Textarea
            label="Nota (opcional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Ej. Verificado con el estado de cuenta del banco"
          />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDialog(null)} disabled={pending}>
              Cancelar
            </Button>
            <Button
              variant={row.action === "VOID" ? "danger" : "primary"}
              loading={pending}
              onClick={() => run(() => approveCorrectionAction(row.id, note.trim()), "Corrección aplicada")}
            >
              Sí, aprobar y aplicar
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={dialog === "reject"} onClose={() => !pending && setDialog(null)} title="¿Rechazar la solicitud?">
        <div className="flex flex-col gap-3 text-sm">
          <p className="text-brand-text">
            No se aplica nada. Quien la pidió recibe un aviso con tu nota para que entienda por qué.
          </p>
          <Textarea
            label="¿Por qué la rechazas?"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            required
            placeholder="Ej. El monto original sí era correcto según el banco"
          />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDialog(null)} disabled={pending}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              loading={pending}
              disabled={note.trim().length < 5}
              onClick={() => run(() => rejectCorrectionAction(row.id, note.trim()), "Solicitud rechazada")}
            >
              Rechazar
            </Button>
          </div>
        </div>
      </Modal>

      <ResultDialog
        open={result !== null}
        tone={result?.ok ? "success" : "danger"}
        title={result?.title ?? ""}
        onClose={() => setResult(null)}
      >
        <p className="text-brand-text">{result?.text}</p>
      </ResultDialog>
    </article>
  );
}
