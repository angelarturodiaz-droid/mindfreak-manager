"use client";

import { useMemo, useState } from "react";
import { ArrowLeftRight, RotateCcw } from "lucide-react";
import { computeFx, needsDocumentRate, type FxKind } from "@/features/currencies/fx";
import { RATE_SOURCE_LABELS, type RateSource } from "@/features/currencies/schema";
import { MoneyInput } from "@/components/ui/money-input";
import { Input } from "@/components/ui/field";
import { InfoHint } from "@/components/ui/info-hint";
import { FIELD_HINTS } from "@/lib/ui/field-hints";
import { formatMoney } from "@/lib/utils/money";
import { todayISO } from "@/lib/utils/dates";

/** Tasas de referencia registradas, por moneda (más recientes primero). */
export type RateEntry = { date: string; rate: number; source: string };
export type RateHistory = Record<string, RateEntry[]>;

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
  markMissing = false,
  missingKey,
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
  /** El servidor dijo que falta un dato: marca en rojo la tasa o el monto vacíos. */
  markMissing?: boolean;
  /** Cambia con cada respuesta del servidor (el estado del formulario): cada error nuevo vuelve a llenar la tasa vacía. */
  missingKey?: unknown;
}) {
  const needAcc = accountCurrency !== functionalCurrency;
  const needDoc = needsDocumentRate({ documentCurrency, accountCurrency, functionalCurrency });
  // Tasa puesta sola después del error "Falta la tasa": si la fecha del pago
  // no tiene tasa, se usa la tasa del día (la última registrada hasta hoy).
  // Se guarda con su moneda: si cambia la cuenta, deja de aplicar.
  const [filled, setFilled] = useState<Record<string, RateEntry | null>>({});
  const accOnDate = needAcc ? rateOn(rates, accountCurrency, date) : null;
  const docOnDate = needDoc ? rateOn(rates, documentCurrency, date) : null;
  const accFound = needAcc ? (accOnDate ?? filled[accountCurrency] ?? null) : null;
  const docFound = needDoc ? (docOnDate ?? filled[documentCurrency] ?? null) : null;
  const accIsToday = needAcc && !accOnDate && accFound !== null;
  const docIsToday = needDoc && !docOnDate && docFound !== null;

  const [accountAmount, setAccountAmount] = useState(0);
  const [fee, setFee] = useState(0);
  // null = el usuario no la escribió: se usa la tasa de referencia del día
  // (cambia sola si cambia la fecha o la cuenta).
  const [accTyped, setAccTyped] = useState<string | null>(null);
  const [docTyped, setDocTyped] = useState<string | null>(null);
  const refAcc = accTyped ?? (accFound ? String(accFound.rate) : "");
  const refDoc = docTyped ?? (docFound ? String(docFound.rate) : "");

  // Vuelve a poner la tasa: la de la fecha del pago si existe, y si no la
  // tasa del día (la última registrada hasta hoy).
  function restoreRate(which: "acc" | "doc") {
    const code = which === "acc" ? accountCurrency : documentCurrency;
    if (which === "acc") setAccTyped(null);
    else setDocTyped(null);
    if (!rateOn(rates, code, date)) {
      const r = rateOn(rates, code, todayISO()) ?? rates[code]?.[0] ?? null;
      setFilled((f) => ({ ...f, [code]: r }));
    }
  }
  const canRestoreAcc = needAcc && (rateOn(rates, accountCurrency, date) ?? rateOn(rates, accountCurrency, todayISO()) ?? rates[accountCurrency]?.[0]) != null;
  const canRestoreDoc = needDoc && (rateOn(rates, documentCurrency, date) ?? rateOn(rates, documentCurrency, todayISO()) ?? rates[documentCurrency]?.[0]) != null;

  // Cada vez que llega el error "Falta un dato", la tasa vacía se vuelve a
  // llenar sola (aunque se haya borrado después de un error anterior).
  const [seenMissing, setSeenMissing] = useState<unknown>(markMissing ? missingKey : null);
  const missingNow = markMissing ? (missingKey ?? true) : null;
  if (seenMissing !== missingNow) {
    setSeenMissing(missingNow);
    if (missingNow !== null) {
      if (needAcc && !(Number(refAcc) > 0)) restoreRate("acc");
      if (needDoc && !(Number(refDoc) > 0)) restoreRate("doc");
    }
  }

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
  const missing = "Falta este dato.";
  const accRateMissing = markMissing && needAcc && !(Number(refAcc) > 0);
  const docRateMissing = markMissing && needDoc && !(Number(refDoc) > 0);
  const amountMissing = markMissing && !(accountAmount > 0);

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

      {/* Sin "required" del navegador (sale en inglés): si falta la tasa o el
          monto, el servidor responde con un mensaje claro en español. */}
      <div className="mt-3 flex flex-wrap items-end gap-2">
        {needAcc && (
          <Input
            label={`Tasa referencia (1 ${accountCurrency} = ? ${functionalCurrency})`}
            type="number"
            step="0.000001"
            value={refAcc}
            onChange={(e) => setAccTyped(e.target.value)}
            info={FIELD_HINTS.referenceRate}
            error={accRateMissing ? `${missing} Escribe la tasa de ${accountCurrency} de ese día.` : undefined}
            hint={
              accFound
                ? `${RATE_SOURCE_LABELS[accFound.source as RateSource] ?? accFound.source} · ${accFound.date}${accIsToday ? " · tasa del día (la fecha del pago no tiene tasa): revísala" : ""}${accOverride ? " · cambiada a mano" : ""}`
                : "No hay tasa registrada: escríbela (o regístrala en Configuración → Monedas y tasas)."
            }
            className="w-44"
          />
        )}
        {canRestoreAcc && (refAcc === "" || !(Number(refAcc) > 0) || accOverride) && (
          <button
            type="button"
            onClick={() => restoreRate("acc")}
            className="mb-6 inline-flex items-center gap-1 rounded-[var(--radius-md)] border border-brand-border bg-white px-2 py-1.5 text-xs text-brand-accent hover:bg-brand-accent-light"
            title="Vuelve a poner la tasa de referencia (la de la fecha del pago o, si no hay, la del día)."
          >
            <RotateCcw size={13} /> Usar tasa del día
          </button>
        )}
        {needDoc && (
          <Input
            label={`Tasa referencia (1 ${documentCurrency} = ? ${functionalCurrency})`}
            type="number"
            step="0.000001"
            value={refDoc}
            onChange={(e) => setDocTyped(e.target.value)}
            info={FIELD_HINTS.referenceRate}
            error={docRateMissing ? `${missing} Escribe la tasa de ${documentCurrency} de ese día.` : undefined}
            hint={
              docFound
                ? `${RATE_SOURCE_LABELS[docFound.source as RateSource] ?? docFound.source} · ${docFound.date}${docIsToday ? " · tasa del día (la fecha del pago no tiene tasa): revísala" : ""}${docOverride ? " · cambiada a mano" : ""}`
                : "No hay tasa registrada: escríbela."
            }
            className="w-44"
          />
        )}
        {canRestoreDoc && (refDoc === "" || !(Number(refDoc) > 0) || docOverride) && (
          <button
            type="button"
            onClick={() => restoreRate("doc")}
            className="mb-6 inline-flex items-center gap-1 rounded-[var(--radius-md)] border border-brand-border bg-white px-2 py-1.5 text-xs text-brand-accent hover:bg-brand-accent-light"
            title="Vuelve a poner la tasa de referencia (la de la fecha del pago o, si no hay, la del día)."
          >
            <RotateCcw size={13} /> Usar tasa del día
          </button>
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
          defaultValue={0}
          onValueChange={setAccountAmount}
          className="w-52"
          error={amountMissing ? `${missing} Copia el monto del estado de cuenta.` : undefined}
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
