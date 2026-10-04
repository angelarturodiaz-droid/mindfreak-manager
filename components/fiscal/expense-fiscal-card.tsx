import { Scale } from "lucide-react";
import { Card } from "@/components/ui/card";
import { InfoHint } from "@/components/ui/info-hint";
import { FIELD_HINTS } from "@/lib/ui/field-hints";
import { DOCUMENT_TYPES } from "@/features/fiscal/rule-schema";
import { formatDateTime } from "@/lib/utils/dates";
import { FiscalBreakdown } from "./fiscal-breakdown";
import { FiscalExplanation, type FiscalRuleSummary } from "./fiscal-explanation";
import { FiscalStatusBadge } from "./fiscal-status-badge";
import { RecalculateFiscalButton } from "./recalculate-fiscal-button";
import { OverrideFiscalButton } from "./override-fiscal-button";

type Snapshot = {
  message?: string;
  explanation?: string;
  missing?: string[];
  rule?: (FiscalRuleSummary & { rule_key?: string }) | null;
  service_type?: string | null;
  classification?: string | null;
};

export type ExpenseFiscalRow = {
  id: string;
  supplier_id: string | null;
  currency: string;
  total: number;
  tax: number;
  fiscal_status: string;
  document_type: string | null;
  ncf: string | null;
  isr_rate: number;
  isr_base_pct: number;
  itbis_retention_pct: number;
  isr_withheld: number;
  itbis_withheld: number;
  total_withheld: number;
  net_payable: number | null;
  fiscal_evaluated_at: string | null;
  fiscal_snapshot: Snapshot | null;
  fiscal_override_reason: string | null;
};

/**
 * Tarjeta "Tratamiento fiscal" del detalle del gasto: muestra lo que quedó
 * GUARDADO al registrarlo (no se recalcula si después cambia una regla).
 */
export function ExpenseFiscalCard({
  expense,
  canRecalculate,
  canOverride = false,
  canSeeRules,
}: {
  expense: ExpenseFiscalRow;
  /** Pendiente y sin pagos, con permiso de editar gastos. */
  canRecalculate: boolean;
  /** Igual, y además permiso expenses.approve. */
  canOverride?: boolean;
  canSeeRules: boolean;
}) {
  const e = expense;
  const snap = e.fiscal_snapshot ?? {};
  const docLabel = DOCUMENT_TYPES.find((d) => d.code === e.document_type)?.label ?? e.document_type;
  const amounts = {
    total: Number(e.total),
    isrRate: Number(e.isr_rate),
    isrBasePct: Number(e.isr_base_pct),
    itbisRetentionPct: Number(e.itbis_retention_pct),
    isrWithheld: Number(e.isr_withheld),
    itbisWithheld: Number(e.itbis_withheld),
    totalWithheld: Number(e.total_withheld),
    netPayable: Number(e.net_payable ?? e.total),
  };

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-brand-text">
          <Scale size={16} className="text-brand-accent" aria-hidden />
          Tratamiento fiscal
          <InfoHint text={FIELD_HINTS.fiscalTreatment} label="Qué es el tratamiento fiscal" />
        </h2>
        <div className="flex items-center gap-1">
          {canOverride && e.supplier_id && (
            <OverrideFiscalButton
              expenseId={e.id}
              currency={e.currency}
              total={Number(e.total)}
              tax={Number(e.tax)}
              isrWithheld={Number(e.isr_withheld)}
              itbisWithheld={Number(e.itbis_withheld)}
            />
          )}
          {canRecalculate && <RecalculateFiscalButton expenseId={e.id} />}
        </div>
      </div>
      <div>
        <FiscalStatusBadge status={e.fiscal_status} />
      </div>

      {e.fiscal_status === "NOT_EVALUATED" ? (
        <p className="text-sm text-brand-muted">
          Este gasto se registró antes de las reglas fiscales: se paga el total, sin retenciones.
          {canRecalculate && " Si le corresponde alguna, elige el tipo de servicio editando el gasto o pulsa Recalcular."}
        </p>
      ) : (
        <FiscalExplanation
          status={e.fiscal_status}
          message={snap.message ?? ""}
          explanation={snap.explanation ?? ""}
          missing={snap.missing ?? []}
          rule={snap.rule ?? null}
          supplierId={e.supplier_id}
          canSeeRules={canSeeRules}
        />
      )}

      {e.fiscal_override_reason && (
        <p className="rounded-[var(--radius-md)] bg-brand-info-bg px-3 py-2 text-xs text-brand-info">
          Ajuste manual: {e.fiscal_override_reason}
        </p>
      )}

      <FiscalBreakdown amounts={amounts} currency={e.currency} />

      <dl className="grid grid-cols-1 gap-x-4 gap-y-1 border-t border-brand-border pt-3 text-xs sm:grid-cols-2">
        <div>
          <dt className="text-brand-muted">Tipo de servicio</dt>
          <dd className="text-brand-text">
            {snap.service_type ?? "—"}
            {snap.classification ? <span className="text-brand-muted"> · {snap.classification}</span> : null}
          </dd>
        </div>
        <div>
          <dt className="text-brand-muted">Comprobante</dt>
          <dd className="text-brand-text">
            {docLabel ?? "—"}
            {e.ncf ? <span className="font-mono"> · {e.ncf}</span> : null}
          </dd>
        </div>
        {e.fiscal_evaluated_at && (
          <div className="sm:col-span-2">
            <dt className="sr-only">Calculado</dt>
            <dd className="text-brand-muted">Calculado el {formatDateTime(e.fiscal_evaluated_at)}</dd>
          </div>
        )}
      </dl>
    </Card>
  );
}
