import { InfoHint } from "@/components/ui/info-hint";
import { FIELD_HINTS } from "@/lib/ui/field-hints";
import { formatMoney } from "@/lib/utils/money";

export type FiscalAmounts = {
  total: number;
  isrRate: number;
  isrBasePct: number;
  itbisRetentionPct: number;
  isrWithheld: number;
  itbisWithheld: number;
  totalWithheld: number;
  netPayable: number;
};

function Row({
  label,
  hint,
  detail,
  value,
  strong,
  negative,
}: {
  label: string;
  hint: string;
  detail?: string;
  value: string;
  strong?: boolean;
  negative?: boolean;
}) {
  return (
    <div className={`flex items-start justify-between gap-3 py-1.5 ${strong ? "border-t border-brand-border pt-2" : ""}`}>
      <div className="flex min-w-0 flex-col">
        <span className={`inline-flex items-center gap-1 text-sm ${strong ? "font-semibold text-brand-text" : "text-brand-text"}`}>
          {label}
          <InfoHint text={hint} label={`Qué es: ${label}`} />
        </span>
        {detail && <span className="text-xs text-brand-muted">{detail}</span>}
      </div>
      <span
        className={`shrink-0 tabular-nums text-sm ${strong ? "font-semibold text-brand-primary" : negative ? "text-brand-danger" : "text-brand-text"}`}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * Desglose "Factura − ISR − ITBIS = le pagas" con ⓘ en cada término.
 * Lo usan la tarjeta del formulario de gasto, el detalle del gasto y el
 * registro de pago, para que el usuario vea siempre la misma explicación.
 */
export function FiscalBreakdown({ amounts, currency }: { amounts: FiscalAmounts; currency: string }) {
  const a = amounts;
  const isrDetail =
    a.isrRate > 0
      ? `${a.isrRate} %${a.isrBasePct < 100 ? ` sobre el ${a.isrBasePct} % del subtotal` : " del subtotal"}`
      : undefined;
  const itbisDetail = a.itbisRetentionPct > 0 ? `${a.itbisRetentionPct} % del ITBIS de la factura` : undefined;
  return (
    <div className="flex flex-col">
      <Row label="Total de la factura" hint={FIELD_HINTS.documentTotal} value={formatMoney(a.total, currency)} />
      {a.isrWithheld > 0 && (
        <Row
          label="ISR retenido"
          hint={FIELD_HINTS.isrWithheld}
          detail={isrDetail}
          value={`− ${formatMoney(a.isrWithheld, currency)}`}
          negative
        />
      )}
      {a.itbisWithheld > 0 && (
        <Row
          label="ITBIS retenido"
          hint={FIELD_HINTS.itbisWithheld}
          detail={itbisDetail}
          value={`− ${formatMoney(a.itbisWithheld, currency)}`}
          negative
        />
      )}
      {a.totalWithheld > 0 && a.isrWithheld > 0 && a.itbisWithheld > 0 && (
        <Row label="Total retenido" hint={FIELD_HINTS.totalWithheld} value={formatMoney(a.totalWithheld, currency)} />
      )}
      <Row label="Neto a pagar al proveedor" hint={FIELD_HINTS.netPayable} value={formatMoney(a.netPayable, currency)} strong />
      {a.totalWithheld > 0 && (
        <p className="mt-2 rounded-[var(--radius-md)] bg-brand-info-bg px-3 py-2 text-xs text-brand-info">
          Al proveedor le pagas <strong>{formatMoney(a.netPayable, currency)}</strong>. Los{" "}
          <strong>{formatMoney(a.totalWithheld, currency)}</strong> retenidos no son un descuento: la empresa se los
          debe a la DGII y los paga a nombre del proveedor en la declaración del mes siguiente (tu contador se encarga).
        </p>
      )}
    </div>
  );
}
