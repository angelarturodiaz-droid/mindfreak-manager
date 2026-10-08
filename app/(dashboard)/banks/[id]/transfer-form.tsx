"use client";

import { useState } from "react";
import { useOverdraftConfirmAction } from "@/components/ui/overdraft-confirm";
import { ArrowLeftRight, ArrowRightLeft } from "lucide-react";
import { createTransferAction, type ActionState } from "@/features/banks/actions";
import { Input, Select } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { Button } from "@/components/ui/button";
import { InfoHint } from "@/components/ui/info-hint";
import { FIELD_HINTS } from "@/lib/ui/field-hints";
import { todayISO } from "@/lib/utils/dates";
import { rateOn, type RateHistory } from "@/components/payments/foreign-payment-block";
import { computeTransferFx } from "@/features/currencies/fx";
import { RATE_SOURCE_LABELS, type RateSource } from "@/features/currencies/schema";

const initialState: ActionState = { error: null };

type Account = {
  id: string;
  name: string;
  bank_name: string | null;
  currency: string;
  type: string;
  /** Saldo actual (en tarjetas: negativo = deuda, positivo = saldo a favor). */
  current_balance: number;
};

function fmt(amount: number, currency: string) {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency }).format(amount);
}
const fmtRate = (n: number) =>
  new Intl.NumberFormat("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 6 }).format(n);
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function TransferForm({
  fromAccountId,
  fromCurrency,
  baseCurrency,
  otherAccounts,
  rates,
}: {
  fromAccountId: string;
  /** Moneda de la cuenta de origen. */
  fromCurrency: string;
  /** Moneda base de la empresa (la tasa se expresa en esta moneda). */
  baseCurrency: string;
  otherAccounts: Account[];
  /** Tasas de referencia registradas (Configuración → Monedas y tasas). */
  rates: RateHistory;
}) {
  const createWithId = createTransferAction.bind(null, fromAccountId);
  const [state, formAction, pending, dialogs, formKey] = useOverdraftConfirmAction(createWithId, initialState);
  const [toId, setToId] = useState("");
  const [amount, setAmount] = useState(0);
  const [received, setReceived] = useState(0);
  const [fee, setFee] = useState(0);
  const [date, setDate] = useState(todayISO());
  // null = el usuario no la escribió: se usa la tasa del día.
  const [refTyped, setRefTyped] = useState<string | null>(null);
  // Después de cada transferencia exitosa el formulario queda en blanco.
  const [seenKey, setSeenKey] = useState(formKey);
  if (seenKey !== formKey) {
    setSeenKey(formKey);
    setToId("");
    setAmount(0);
    setReceived(0);
    setFee(0);
    setDate(todayISO());
    setRefTyped(null);
  }

  if (otherAccounts.length === 0) {
    return (
      <p className="text-sm text-brand-muted">
        Necesitas al menos otra cuenta o tarjeta activa para poder transferir. Créala en Bancos →
        Nueva cuenta o tarjeta.
      </p>
    );
  }

  const to = otherAccounts.find((a) => a.id === toId);
  const crossCurrency = Boolean(to && to.currency !== fromCurrency);
  const foreign = to ? (fromCurrency === baseCurrency ? to.currency : fromCurrency) : "";
  const fromIsBase = fromCurrency === baseCurrency;
  const refFound = crossCurrency ? rateOn(rates, foreign, date) : null;
  const refText = refTyped ?? (refFound ? String(refFound.rate) : "");
  const ref = Number(refText) || 0;
  const refOverride = refFound !== null && ref > 0 && ref !== refFound.rate;

  // Todo en "1 moneda extranjera = X moneda base"; diferencia positiva = desfavorable.
  const fx = crossCurrency ? computeTransferFx({ fromIsBase, amount, received, ref }) : null;
  const estimated = fx?.estimated ?? null;
  const effective = fx?.effective ?? null;
  const diff = fx?.difference ?? null;

  // Pago a una tarjeta mayor que su deuda: no es error, el excedente queda
  // como saldo a favor (reglas de la migración 063).
  const amountIntoDestination = crossCurrency ? (received > 0 ? received : null) : amount > 0 ? amount : null;
  const cardDebt = to?.type === "CREDIT_CARD" ? Math.max(0, -to.current_balance) : null;
  const cardExcess =
    cardDebt !== null && amountIntoDestination !== null && amountIntoDestination > cardDebt
      ? Math.round((amountIntoDestination - cardDebt) * 100) / 100
      : null;

  return (
    <form key={formKey} action={formAction} className="flex flex-wrap items-end gap-2">
      <Select
        label="Cuenta destino"
        name="to_bank_account_id"
        required
        value={toId}
        onChange={(e) => {
          setToId(e.target.value);
          setRefTyped(null);
        }}
      >
        <option value="" disabled>
          Selecciona…
        </option>
        {otherAccounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name} ({a.currency}){a.type === "CREDIT_CARD" ? " — Tarjeta" : ""}
          </option>
        ))}
      </Select>
      <Input
        label="Fecha"
        name="transaction_date"
        type="date"
        required
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />
      <MoneyInput
        label={`Monto que sale (${fromCurrency})`}
        name="amount"
        min={0.01}
        required
        defaultValue={0}
        className="w-36"
        onValueChange={setAmount}
      />
      <MoneyInput
        label={`Comisión del banco (opcional, ${fromCurrency})`}
        name="fee"
        min={0}
        defaultValue={0}
        className="w-52"
        onValueChange={setFee}
        hint="Lo que cobró este banco por enviar. Se registra aparte."
      />
      <Input label="Descripción" name="description" placeholder="Opcional" className="w-48" />

      {crossCurrency && to && (
        <div className="w-full rounded-[var(--radius-md)] border border-brand-accent/40 bg-brand-accent-light/40 p-3">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-brand-text">
            <ArrowLeftRight size={15} /> Transferencia entre monedas ({fromCurrency} → {to.currency})
            <InfoHint text={FIELD_HINTS.transferReceived} label="Cómo funciona una transferencia entre monedas" />
          </p>
          <input type="hidden" name="reference_rate_source" value={refOverride || !refFound ? "MANUAL" : refFound.source} />
          <div className="flex flex-wrap items-end gap-2">
            <Input
              label={`Tasa del día (1 ${foreign} = ? ${baseCurrency})`}
              name="reference_rate"
              type="number"
              step="0.000001"
              value={refText}
              onChange={(e) => setRefTyped(e.target.value)}
              info={FIELD_HINTS.referenceRate}
              hint={
                refFound
                  ? `${RATE_SOURCE_LABELS[refFound.source as RateSource] ?? refFound.source} · ${refFound.date}${refOverride ? " · cambiada a mano" : ""}`
                  : "Opcional: solo para comparar. Regístrala en Configuración → Monedas y tasas."
              }
              className="w-48"
            />
            <MoneyInput
              label={`¿Cuánto entró en ${to.name}? (${to.currency})`}
              name="to_amount"
              defaultValue={0}
              className="w-56"
              onValueChange={setReceived}
              hint={estimated !== null ? `Estimado a la tasa del día: ${fmt(estimated, to.currency)}` : "Lo que dice el estado de cuenta de la otra cuenta."}
            />
          </div>
          {effective !== null && (
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-brand-muted">Tasa efectiva</dt>
              <dd className="tabular-nums">
                1 {foreign} = {fmtRate(effective)} {baseCurrency}
              </dd>
              {diff !== null && (
                <>
                  <dt className="text-brand-muted">Diferencia informativa</dt>
                  <dd className={`tabular-nums ${diff > 0 ? "text-brand-warning" : diff < 0 ? "text-brand-success" : ""}`}>
                    {fmt(diff, baseCurrency)}
                    {diff !== 0 && (
                      <span className="ml-1 text-xs text-brand-muted">
                        {diff > 0 ? "(se entregó más valor que la tasa del día)" : "(se recibió más valor que la tasa del día)"}
                      </span>
                    )}
                  </dd>
                </>
              )}
            </dl>
          )}
          <p className="mt-3 text-xs text-brand-muted">
            ⓘ Sale <strong>{amount > 0 ? fmt(amount, fromCurrency) : `el monto en ${fromCurrency}`}</strong>
            {fee > 0 ? <> (más {fmt(fee, fromCurrency)} de comisión)</> : null} y entra{" "}
            <strong>{received > 0 ? fmt(received, to.currency) : `lo que indiques en ${to.currency}`}</strong> en {to.name}.
            Cada cuenta se mueve solo en su moneda. La diferencia informativa no es una ganancia ni una pérdida contable.
          </p>
        </div>
      )}
      {!crossCurrency && to && fee > 0 && amount > 0 && (
        <p className="w-full text-xs text-brand-muted">
          Sale {fmt(amount, fromCurrency)} + {fmt(fee, fromCurrency)} de comisión (total {fmt(r2(amount + fee), fromCurrency)}); entra{" "}
          {fmt(amount, to.currency)} en {to.name}.
        </p>
      )}

      <Button type="submit" loading={pending} icon={<ArrowRightLeft size={14} />}>
        Transferir
      </Button>
      {to && cardExcess !== null && (
        <p className="w-full rounded-[var(--radius-md)] bg-brand-success-bg px-3 py-2 text-sm text-brand-text">
          {cardDebt === 0
            ? `La tarjeta ${to.name} no tiene deuda. Los ${fmt(cardExcess, to.currency)} quedarán como saldo a favor.`
            : `La tarjeta no tiene suficiente deuda para aplicar el pago completo (debe ${fmt(cardDebt ?? 0, to.currency)}). El excedente de ${fmt(cardExcess, to.currency)} se registrará como saldo a favor.`}
        </p>
      )}
      {state.error && <p className="w-full text-sm text-brand-danger">{state.error}</p>}
      {dialogs}
    </form>
  );
}
