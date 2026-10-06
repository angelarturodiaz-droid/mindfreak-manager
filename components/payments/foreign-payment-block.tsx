"use client";

import { useMemo, useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { computeFx, needsDocumentRate, type FxKind } from "@/features/currencies/fx";
import { RATE_SOURCE_LABELS, type RateSource } from "@/features/currencies/schema";
import { MoneyInput } from "@/components/ui/money-input";
import { Input } from "@/components/ui/field";
import { InfoHint } from "@/components/ui/info-hint";
import { FIELD_HINTS } from "@/lib/ui/field-hints";
import { formatMoney } from "@/lib/utils/money";

/** Tasas de referencia registradas, por moneda (más recientes primero). */
export type RateHistory = Record<string, { date: string; rate: number; source: string }[]>;

/** Última tasa registrada en o antes de la fecha. */
export function rateOn(history: RateHistory, code: string, date: string) {
  return (history[code] ?? []).find((r) => r.date <= date) ?? null;
}

const fmtRate = (n: number) =>
  new Intl.NumberFormat("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 6 }).format(n);

/**
 * Bloque "Pago en moneda diferente" (multimoneda V5). Aparece cuando la
 * cuenta elegida está en otra moneda que el documento. Pide cuánto debitó
 * realmente el banco y muestra en vivo la tasa efectiva y la diferencia
 * informativa. Los campos van dentro del <form> del pago; el servidor
 * recalcula todo (la pantalla solo informa).
 */
export function ForeignPaymentBlock({
  kind = "PAGO",
  documentCurrency,
  documentLabel = kind === "PAGO" ? "gasto" : "factura",
  accountCurrency,
  accountName,
  functionalCurrency,
  applied,
  date,
  rates,
  tolerance,
}: {
  kind?: FxKind;
  documentCurrency: string;
  documentLabel?: string;
  accountCurrency: string;
  accountName: string;
  functionalCurrency: string;
  /** Monto aplicado al documento (en su moneda). */
  applied: number;
  /** Fecha del pago (para buscar la tasa de referencia del día). */
  date: string;
  rates: RateHistory;
  tolerance: number;
}) {
  const needAcc = accountCurrency !== functionalCurrency;
  const needDoc = needsDocumentRate({ documentCurrency, accountCurrency, functionalCurrency });
  const accFound = needAcc ? rateOn(rates, accountCurrency, date) : null;
  const docFound = needDoc ? rateOn(rates, documentCurrency, date) : null;

  const [accountAmount, setAccountAmount] = useState(0);
  const [fee, setFee] = useState(0);
  // null = el usuario no la escribió: se usa la tasa de referencia del día
  // (cambia sola si cambia la fecha o la cuenta).
  const [accTyped, setAccTyped] = useState<string | null>(null);
  const [docTyped, setDocTyped] = useState<string | null>(null);
  const refAcc = accTyped ?? (accFound ? String(accFound.rate) : "");
  const refDoc = docTyped ?? (docFound ? String(docFound.rate) : "");

  const fx = useMemo(
    () =>
      computeFx({
        kind,
        documentCurrency,
        accountCurrency,
        functionalCurrency,
        applied,
        accountAmount,
        referenceRate: Number(refAcc) || null,
        referenceRateDocument: Number(refDoc) || null,
        tolerance,
      }),
    [kind, documentCurrency, accountCurrency, functionalCurrency, applied, accountAmount, refAcc, refDoc, tolerance],
  );

  const accOverride = needAcc && accFound !== null && Number(refAcc) > 0 && Number(refAcc) !== accFound.rate;
  const docOverride = needDoc && docFound !== null && Number(refDoc) > 0 && Number(refDoc) !== docFound.rate;
  const override = accOverride || docOverride;
  const source = override
    ? "MANUAL"
    : (needAcc ? accFound?.source : docFound?.source) ?? "MANUAL";
  const totalDebit = Math.round((accountAmount + fee) * 100) / 100;
  const verb = kind === "PAGO" ? "debitó" : "acreditó";
  const diff = fx.informativeDifference || fx.roundingDifference;

  return (
    <div className="w-full rounded-[var(--radius-md)] border border-brand-accent/40 bg-brand-accent-light/40 p-3">
      <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-brand-text">
        <ArrowLeftRight size={15} /> {kind === "PAGO" ? "Pago" : "Cobro"} en moneda diferente
        <InfoHint text={FIELD_HINTS.foreignPayment} label={`Qué es un ${kind === "PAGO" ? "pago" : "cobro"} en moneda diferente`} />
      </p>

      {/* Datos que guarda el servidor (recalcula todo; la pantalla solo informa). */}
      <input type="hidden" name="reference_rate" value={needAcc ? refAcc : ""} />
      <input type="hidden" name="reference_rate_document" value={needDoc ? refDoc : ""} />
      <input type="hidden" name="reference_rate_source" value={source} />
      <input type="hidden" name="rate_date" value={(needAcc ? accFound?.date : docFound?.date) ?? date} />
      <input type="hidden" name="rate_manual_override" value={override ? "1" : ""} />
      <input
        type="hidden"
        name="rate_previous"
        value={accOverride ? String(accFound?.rate ?? "") : docOverride ? String(docFound?.rate ?? "") : ""}
      />

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-brand-muted">Monto a {kind === "PAGO" ? "pagar" : "cobrar"}</dt>
        <dd className="font-semibold tabular-nums">{formatMoney(applied || 0, documentCurrency)}</dd>
        <dt className="text-brand-muted">Cuenta</dt>
        <dd>
          {accountName} <span className="text-brand-muted">({accountCurrency})</span>
        </dd>
      </dl>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        {needAcc && (
          <Input
            label={`Tasa referencia (1 ${accountCurrency} = ? ${functionalCurrency})`}
            type="number"
            step="0.000001"
            min="0.000001"
            required
            value={refAcc}
            onChange={(e) => setAccTyped(e.target.value)}
            info={FIELD_HINTS.referenceRate}
            hint={
              accFound
                ? `${RATE_SOURCE_LABELS[accFound.source as RateSource] ?? accFound.source} · ${accFound.date}${accOverride ? " · cambiada a mano" : ""}`
                : "No hay tasa registrada: escríbela (o regístrala en Configuración → Monedas y tasas)."
            }
            className="w-44"
          />
        )}
        {needDoc && (
          <Input
            label={`Tasa referencia (1 ${documentCurrency} = ? ${functionalCurrency})`}
            type="number"
            step="0.000001"
            min="0.000001"
            required
            value={refDoc}
            onChange={(e) => setDocTyped(e.target.value)}
            info={FIELD_HINTS.referenceRate}
            hint={
              docFound
                ? `${RATE_SOURCE_LABELS[docFound.source as RateSource] ?? docFound.source} · ${docFound.date}${docOverride ? " · cambiada a mano" : ""}`
                : "No hay tasa registrada: escríbela."
            }
            className="w-44"
          />
        )}
      </div>

      <p className="mt-2 text-sm">
        <span className="text-brand-muted">
          {kind === "PAGO" ? "Débito" : "Crédito"} estimado:{" "}
        </span>
        <strong className="tabular-nums">
          {fx.estimatedAccountAmount !== null ? formatMoney(fx.estimatedAccountAmount, accountCurrency) : "— (falta la tasa)"}
        </strong>
      </p>

      <div className="mt-2 flex flex-wrap items-end gap-2">
        <MoneyInput
          label={`¿Cuánto ${verb} realmente el banco? (${accountCurrency})`}
          name="account_amount"
          min={0.01}
          required
          defaultValue={0}
          onValueChange={setAccountAmount}
          className="w-52"
          hint={
            kind === "PAGO"
              ? "Lo que aparece en el estado de cuenta, sin la comisión."
              : "Lo que entró, antes de descontar la comisión del banco."
          }
        />
        <MoneyInput
          label={
            kind === "PAGO"
              ? `Comisión (opcional, ${accountCurrency})`
              : `Comisión del banco (opcional, ${accountCurrency})`
          }
          name="bank_fee"
          min={0}
          defaultValue={0}
          onValueChange={setFee}
          className="w-52"
          hint={
            kind === "PAGO"
              ? "Se registra aparte como Comisiones bancarias."
              : "Lo que el banco cobró por recibir el dinero. Se registra aparte como Comisiones bancarias."
          }
        />
      </div>

      {fx.effectiveRate !== null && (
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-brand-muted">Tasa efectiva</dt>
          <dd className="tabular-nums">
            1 {fx.effectiveRateCurrency} = {fmtRate(fx.effectiveRate)} {functionalCurrency}
          </dd>
          <dt className="text-brand-muted">
            {fx.roundingDifference !== 0 ? "Redondeo" : "Diferencia informativa"}
          </dt>
          <dd className={`tabular-nums ${diff > 0 ? "text-brand-warning" : diff < 0 ? "text-brand-success" : ""}`}>
            {formatMoney(diff, functionalCurrency)}
            {diff !== 0 && (
              <span className="ml-1 text-xs text-brand-muted">
                {fx.roundingDifference !== 0
                  ? `(dentro de la tolerancia de ${formatMoney(tolerance, functionalCurrency)})`
                  : diff > 0
                    ? kind === "PAGO"
                      ? "(salió más que la referencia)"
                      : "(entró menos que la referencia)"
                    : kind === "PAGO"
                      ? "(salió menos que la referencia)"
                      : "(entró más que la referencia)"}
              </span>
            )}
          </dd>
          {fee > 0 && (
            <>
              <dt className="text-brand-muted">{kind === "PAGO" ? "Débito total" : "Neto en la cuenta"}</dt>
              <dd className="font-semibold tabular-nums">
                {formatMoney(kind === "PAGO" ? totalDebit : Math.round((accountAmount - fee) * 100) / 100, accountCurrency)}
              </dd>
            </>
          )}
        </dl>
      )}

      <p className="mt-3 text-xs text-brand-muted">
        ⓘ {kind === "PAGO" ? "El" : "La"} {documentLabel} continuará {kind === "PAGO" ? "registrado" : "registrada"} en {documentCurrency}. La cuenta {accountName} será afectada
        únicamente por {accountAmount > 0 ? formatMoney(accountAmount, accountCurrency) : `el monto en ${accountCurrency}`}
        {kind === "PAGO" ? " (más la comisión, si la indicas)" : " (menos la comisión, si la indicas)"}. La diferencia informativa no es una ganancia ni una
        pérdida contable.
      </p>
    </div>
  );
}
