"use client";

import { useState } from "react";
import { useOverdraftConfirmAction } from "@/components/ui/overdraft-confirm";
import { registerPaymentAction, type ActionState } from "@/features/payments/actions";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@/features/payments/schema";
import { Input, Select } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { Button } from "@/components/ui/button";
import { todayISO } from "@/lib/utils/dates";
import { formatMoney } from "@/lib/utils/money";
import { AccountPicker } from "@/components/payments/account-picker";
import { AccountIncomingHint } from "@/components/banks/account-funds-hint";
import type { AccountFunds } from "@/features/banks/queries";
import { FormSection, FormFooter } from "@/components/payments/form-section";
import { CancelConfirm } from "@/components/payments/cancel-confirm";
import { ForeignPaymentBlock, type RateHistory } from "@/components/payments/foreign-payment-block";
import {
  CustomerWithholdingsFields,
  newWithholdingRow,
  withholdingsPayload,
  type WithholdingRow,
} from "@/components/payments/customer-withholdings-fields";
import { InfoHint } from "@/components/ui/info-hint";
import { summarizeCobro, suggestedReceived, WITHHOLDING_TYPE_LABELS } from "@/features/payments/withholdings";

const initialState: ActionState = { error: null };

type BankAccount = { id: string; name: string; bank_name: string | null; currency: string; type?: string | null };
type CategoryOption = { id: string; name: string };

/** Compara nombres sin mayúsculas ni acentos ("Cobro de Factura" = "cobro de factura"). */
function normalize(name: string) {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
}

export function RegisterPaymentForm({
  invoiceId,
  clientId,
  projectId,
  balance,
  currency,
  bankAccounts,
  categories,
  fxContext,
  funds = {},
  invoiceRate = 1,
}: {
  invoiceId: string;
  clientId: string;
  projectId: string | null;
  balance: number;
  currency: string;
  bankAccounts: BankAccount[];
  categories: CategoryOption[];
  /** Moneda funcional, tolerancia y tasas de referencia (cobro en moneda diferente). */
  fxContext: { functionalCurrency: string; tolerance: number; rates: RateHistory };
  /** Saldo de cada cuenta (solo informativo en el cobro). */
  funds?: Record<string, AccountFunds>;
  /** Tasa de la factura (para convertir el certificado de retención en RD$). */
  invoiceRate?: number;
}) {
  const registerWithIds = registerPaymentAction.bind(null, invoiceId, clientId, projectId);
  // Ventana verde al terminar, roja si el monto pasa de lo pendiente.
  const [state, formAction, pending, dialogs, formKey] = useOverdraftConfirmAction(registerWithIds, initialState);
  // Por defecto "Cobro de factura" (lo mismo que pone el sistema si no se elige nada).
  const defaultCategory = categories.find((c) => normalize(c.name) === "cobro de factura");

  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState(balance);
  const [paymentDate, setPaymentDate] = useState(todayISO());
  // Cuenta en otra moneda: lo que el banco acreditó (para el saldo "quedará en").
  const [bankIn, setBankIn] = useState<{ amount: number; fee: number }>({ amount: 0, fee: 0 });
  // Retenciones del cliente (migración 083).
  const [hasWithholdings, setHasWithholdings] = useState(false);
  const [whRows, setWhRows] = useState<WithholdingRow[]>([]);
  // "Recibido en banco" se ajusta solo (saldo − retenciones) hasta que el usuario lo escriba.
  const [receivedManual, setReceivedManual] = useState(false);
  const [receivedKey, setReceivedKey] = useState(0);
  // Después de un cobro exitoso, o con "Cancelar", el formulario vuelve a empezar.
  const [seenKey, setSeenKey] = useState(formKey);
  const [resets, setResets] = useState(0);
  const [clearedState, setClearedState] = useState<ActionState | null>(null);
  function restart() {
    setAccountId("");
    setBankIn({ amount: 0, fee: 0 });
    setAmount(balance);
    setPaymentDate(todayISO());
    setHasWithholdings(false);
    setWhRows([]);
    setReceivedManual(false);
  }
  if (seenKey !== formKey) {
    setSeenKey(formKey);
    restart();
  }
  function cancel() {
    restart();
    setResets((n) => n + 1);
    setClearedState(state); // oculta el error que había
  }
  const shown = clearedState === state ? initialState : state;
  const account = bankAccounts.find((b) => b.id === accountId);
  // Cuenta en otra moneda que la factura → bloque "Cobro en moneda diferente".
  const foreign = Boolean(account && account.currency !== currency);

  const activeRows = hasWithholdings ? whRows : [];
  const summary = summarizeCobro({ balance, received: amount, withholdings: activeRows });
  const onlyWithholding = hasWithholdings && summary.withholdingTotal > 0 && amount <= 0;
  const foreignInvoice = currency !== fxContext.functionalCurrency;

  // Cambian las retenciones → si el recibido no se escribió a mano, se ajusta solo.
  function changeRows(rows: WithholdingRow[]) {
    setWhRows(rows);
    if (!receivedManual) {
      const total = rows.reduce((a, r) => a + (r.amount > 0 ? r.amount : 0), 0);
      setAmount(suggestedReceived(balance, total));
      setReceivedKey((k) => k + 1);
    }
  }
  function toggleWithholdings(on: boolean) {
    setHasWithholdings(on);
    const rows = on ? (whRows.length ? whRows : [newWithholdingRow()]) : whRows;
    if (on) changeRows(rows);
    else if (!receivedManual) {
      setAmount(balance);
      setReceivedKey((k) => k + 1);
    }
  }

  return (
    <form
      key={`${formKey}-${resets}`}
      action={formAction}
      className="space-y-5"
    >
      <FormSection step={1} title="Datos del cobro">
        <Input
          label="Fecha"
          name="payment_date"
          type="date"
          required
          value={paymentDate}
          onChange={(e) => setPaymentDate(e.target.value)}
        />
        <MoneyInput
          key={`received-${receivedKey}`}
          label={hasWithholdings ? "Recibido en banco" : "Monto"}
          name="amount"
          min={0}
          required
          defaultValue={amount}
          hint={
            hasWithholdings
              ? `Lo que entró al banco, sin las retenciones. Saldo ${formatMoney(balance, currency)}.`
              : `Máx. ${formatMoney(balance, currency)}`
          }
          onValueChange={(v) => {
            setAmount(v);
            setReceivedManual(true);
          }}
        />
        <Select label="Método" name="method" defaultValue="TRANSFER">
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {PAYMENT_METHOD_LABELS[m]}
            </option>
          ))}
        </Select>
      </FormSection>

      <fieldset className="space-y-3">
        <legend className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brand-muted">
          Retenciones del cliente
          <InfoHint text="Las retenciones son montos que el cliente descuenta del pago y entrega o declara a la DGII (te da un certificado). Ese dinero no entra al banco, pero sí rebaja el saldo de la factura." />
        </legend>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className="text-brand-text">¿El cliente realizó retenciones?</span>
          <label className="flex items-center gap-1.5">
            <input type="radio" name="wh_toggle" checked={!hasWithholdings} onChange={() => toggleWithholdings(false)} />
            No
          </label>
          <label className="flex items-center gap-1.5">
            <input type="radio" name="wh_toggle" checked={hasWithholdings} onChange={() => toggleWithholdings(true)} />
            Sí
          </label>
        </div>
        <input type="hidden" name="has_withholdings" value={hasWithholdings ? "1" : "0"} />
        <input
          type="hidden"
          name="withholdings"
          value={JSON.stringify(withholdingsPayload(activeRows, foreignInvoice))}
        />
        {hasWithholdings && (
          <>
            <CustomerWithholdingsFields
              rows={whRows}
              onChange={changeRows}
              invoiceCurrency={currency}
              functionalCurrency={fxContext.functionalCurrency}
              invoiceRate={invoiceRate}
            />
            <div
              className={`rounded-[var(--radius-md)] border px-3 py-2.5 text-sm ${
                summary.exceeds ? "border-brand-danger/40 bg-brand-danger-bg" : "border-brand-border bg-brand-surface-hover"
              }`}
              role="status"
            >
              <dl className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4">
                <div>
                  <dt className="text-xs text-brand-muted">Saldo de la factura</dt>
                  <dd className="font-medium tabular-nums">{formatMoney(balance, currency)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-brand-muted">Recibido en banco</dt>
                  <dd className="font-medium tabular-nums">{formatMoney(amount > 0 ? amount : 0, currency)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-brand-muted">Retenciones</dt>
                  <dd className="font-medium tabular-nums">
                    {formatMoney(summary.withholdingTotal, currency)}
                    {activeRows.length > 0 && (
                      <span className="block text-[11px] font-normal text-brand-muted">
                        {activeRows
                          .filter((r) => r.amount > 0)
                          .map((r) => `${WITHHOLDING_TYPE_LABELS[r.type]} ${formatMoney(r.amount, currency)}`)
                          .join(" · ")}
                      </span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-brand-muted">Total aplicado → saldo después</dt>
                  <dd className={`font-semibold tabular-nums ${summary.exceeds ? "text-brand-danger" : "text-brand-text"}`}>
                    {formatMoney(summary.applied, currency)} → {formatMoney(summary.after, currency)}
                  </dd>
                </div>
              </dl>
              {summary.exceeds && (
                <p className="mt-1.5 text-xs font-medium text-brand-danger">
                  El recibido más las retenciones supera el saldo de la factura. Baja el recibido o la retención.
                </p>
              )}
            </div>
          </>
        )}
      </fieldset>

      {onlyWithholding ? (
        <FormSection step={2} title="Cuenta donde entra el dinero" cols={2}>
          <p className="text-sm text-brand-muted sm:col-span-2">
            No entra dinero al banco: solo se aplica la retención a la factura (ej. cuando el certificado llega después de
            que el cliente pagó el neto). No hace falta elegir cuenta.
          </p>
          <Input label="Referencia" name="reference" placeholder="Opcional (ej. número de certificado)" />
        </FormSection>
      ) : (
      <FormSection step={2} title="Cuenta donde entra el dinero" cols={2}>
        <AccountPicker
          accounts={bankAccounts}
          kind="bank"
          direction="in"
          documentCurrency={currency}
          value={accountId}
          onChange={(id) => {
            setAccountId(id);
            setBankIn({ amount: 0, fee: 0 });
          }}
          label="Cuenta bancaria"
        />
        <Input label="Referencia" name="reference" placeholder="Opcional (ej. número de transferencia)" />
        {accountId && (
          <div className="sm:col-span-2">
            <AccountIncomingHint
              funds={funds[accountId]}
              amount={amount}
              amountCurrency={currency}
              bank={foreign ? bankIn : undefined}
            />
          </div>
        )}
        {account && foreign && (
          <div className="sm:col-span-2">
            <ForeignPaymentBlock
              key={`${account.id}-${formKey}-${resets}`}
              kind="COBRO"
              documentLabel="factura"
              documentCurrency={currency}
              accountCurrency={account.currency}
              accountName={account.name}
              functionalCurrency={fxContext.functionalCurrency}
              applied={amount}
              date={paymentDate}
              rates={fxContext.rates}
              tolerance={fxContext.tolerance}
              markMissing={shown.field === "fx"}
              missingKey={shown}
              onBankChange={setBankIn}
            />
          </div>
        )}
      </FormSection>
      )}

      <FormSection step={3} title="Clasificación" cols={2}>
        <Select
          label="Categoría"
          name="category_id"
          defaultValue={defaultCategory?.id ?? ""}
          hint="Cómo se clasifica el ingreso en Bancos y reportes"
        >
          {!defaultCategory && <option value="">Cobro de factura (automática)</option>}
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </FormSection>

      <FormFooter error={shown.error}>
        <CancelConfirm what="cobro" backHref="/invoices" backLabel="Facturas" onDiscard={cancel} disabled={pending} />
        <Button type="submit" loading={pending} disabled={summary.exceeds}>
          {onlyWithholding ? "Aplicar retención" : "Registrar cobro"}
        </Button>
      </FormFooter>
      {dialogs}
    </form>
  );
}
