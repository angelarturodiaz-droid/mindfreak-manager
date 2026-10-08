"use client";

import { useState } from "react";
import { useOverdraftConfirmAction } from "@/components/ui/overdraft-confirm";
import { AccountFundsHint } from "@/components/banks/account-funds-hint";
import type { AccountFunds } from "@/features/banks/queries";
import {
  registerSupplierPaymentAction,
  type ActionState,
} from "@/features/payments/actions";
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
} from "@/features/payments/schema";
import { Input, Select } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { Button } from "@/components/ui/button";
import { todayISO } from "@/lib/utils/dates";
import { formatMoney } from "@/lib/utils/money";
import { InfoHint } from "@/components/ui/info-hint";
import { FIELD_HINTS } from "@/lib/ui/field-hints";
import {
  FiscalBreakdown,
  type FiscalAmounts,
} from "@/components/fiscal/fiscal-breakdown";
import { EXPENSE_FISCAL_REVIEW } from "@/features/fiscal/expense-labels";
import { ForeignPaymentBlock, type RateHistory } from "@/components/payments/foreign-payment-block";
import { AccountPicker } from "@/components/payments/account-picker";

const initialState: ActionState = { error: null };

type BankAccount = {
  id: string;
  name: string;
  bank_name: string | null;
  currency: string;
  /** BANK o CREDIT_CARD: un gasto pendiente también se puede pagar con tarjeta. */
  type?: string;
};
type BankCatalogEntry = { id: string; name: string };

export function RegisterSupplierPaymentForm({
  expenseId,
  supplierId,
  projectId,
  balance,
  currency,
  bankAccounts,
  bankCatalog,
  funds = {},
  fiscal = null,
  fiscalStatus = "NOT_EVALUATED",
  fxContext,
  defaultMethod,
}: {
  expenseId: string;
  supplierId: string | null;
  projectId: string | null;
  balance: number;
  currency: string;
  bankAccounts: BankAccount[];
  bankCatalog: BankCatalogEntry[];
  /** Saldo de cada cuenta, para mostrar cuánto hay disponible en la elegida. */
  funds?: Record<string, AccountFunds>;
  /** Retenciones guardadas en el gasto (null si no hay): se explica el neto. */
  fiscal?: FiscalAmounts | null;
  fiscalStatus?: string;
  /** Moneda funcional, tolerancia y tasas de referencia (pago en moneda diferente). */
  fxContext: { functionalCurrency: string; tolerance: number; rates: RateHistory };
  /** Método elegido al crear el gasto (ej. CARD): es el que viene seleccionado. */
  defaultMethod?: string | null;
}) {
  const registerWithIds = registerSupplierPaymentAction.bind(
    null,
    expenseId,
    supplierId,
    projectId,
  );
  const [state, formAction, pending, dialogs, formKey] =
    useOverdraftConfirmAction(registerWithIds, initialState);
  const [accountId, setAccountId] = useState("");
  const startMethod = defaultMethod && PAYMENT_METHODS.includes(defaultMethod as (typeof PAYMENT_METHODS)[number]) ? defaultMethod : "TRANSFER";
  const [method, setMethod] = useState(startMethod);
  const [amount, setAmount] = useState(balance);
  const [paymentDate, setPaymentDate] = useState(todayISO());
  // Después de un pago exitoso, o con "Cancelar", el formulario vuelve a empezar.
  const [seenKey, setSeenKey] = useState(formKey);
  const [resets, setResets] = useState(0);
  const [clearedState, setClearedState] = useState<ActionState | null>(null);
  function restart() {
    setAccountId("");
    setMethod(startMethod);
    setAmount(balance);
    setPaymentDate(todayISO());
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
  // El método decide qué se lista: Tarjeta → tarjetas de crédito; el resto → cuentas de banco.
  const isCard = method === "CARD";
  // Cuenta en otra moneda que el gasto → bloque "Pago en moneda diferente".
  const foreign = Boolean(account && account.currency !== currency);

  const paidSoFar = fiscal
    ? Math.max(0, Math.round((fiscal.netPayable - balance) * 100) / 100)
    : 0;

  return (
    <div className="flex flex-col gap-3">
      {fiscal && (
        <details
          open
          className="rounded-[var(--radius-md)] border border-brand-border px-3 py-2"
        >
          <summary className="cursor-pointer text-sm font-medium text-brand-text">
            ¿Cuánto le pago al proveedor?{" "}
            <span className="font-normal text-brand-muted">
              (este gasto tiene retenciones)
            </span>
          </summary>
          <div className="mt-2">
            <FiscalBreakdown amounts={fiscal} currency={currency} />
            {paidSoFar > 0 && (
              <p className="mt-2 text-xs text-brand-muted">
                Ya le pagaste {formatMoney(paidSoFar, currency)}; falta{" "}
                <strong className="text-brand-text">
                  {formatMoney(balance, currency)}
                </strong>
                .
              </p>
            )}
          </div>
        </details>
      )}
      {!fiscal && EXPENSE_FISCAL_REVIEW.includes(fiscalStatus) && (
        <p className="rounded-[var(--radius-md)] bg-brand-warning-bg px-3 py-2 text-xs text-brand-warning">
          El tratamiento fiscal de este gasto está <strong>por revisar</strong>{" "}
          (ver la tarjeta “Tratamiento fiscal”). Si pagas ahora se le paga el
          total, sin retenciones. Si le corresponde retención, completa los
          datos y pulsa “Recalcular” <strong>antes</strong> del primer pago.
        </p>
      )}
      <form
        key={`${formKey}-${resets}`}
        action={formAction}
        className="flex flex-wrap items-end gap-2"
      >
        <Input
          label="Fecha"
          name="payment_date"
          type="date"
          required
          value={paymentDate}
          onChange={(e) => setPaymentDate(e.target.value)}
        />
        <MoneyInput
          label="Monto"
          name="amount"
          min={0.01}
          required
          defaultValue={balance}
          hint={
            fiscal
              ? `Neto pendiente. Máx. ${formatMoney(balance, currency)}`
              : `Máx. ${balance.toFixed(2)} ${currency}`
          }
          className="w-40"
          onValueChange={setAmount}
        />
        <Select
          label="Método"
          name="method"
          value={method}
          onChange={(e) => {
            const next = e.target.value;
            // Tarjeta = tarjetas de crédito; los demás métodos = cuentas de banco.
            if ((next === "CARD") !== (method === "CARD")) setAccountId("");
            setMethod(next);
          }}
          hint={isCard ? "Muestra solo tarjetas de crédito." : "Muestra solo cuentas de banco."}
        >
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {PAYMENT_METHOD_LABELS[m]}
            </option>
          ))}
        </Select>
        <AccountPicker
          accounts={bankAccounts}
          kind={isCard ? "card" : "bank"}
          documentCurrency={currency}
          value={accountId}
          onChange={setAccountId}
          hint={isCard ? "El pago sube la deuda de la tarjeta." : undefined}
        />
        <Input label="Referencia" name="reference" />
        <Select
          label="Banco del proveedor (opcional)"
          name="payee_bank_name"
          defaultValue=""
          hint="A dónde se le depositó a él, no tu cuenta de origen."
          className="w-56"
        >
          <option value="">Sin especificar</option>
          {bankCatalog.map((b) => (
            <option key={b.id} value={b.name}>
              {b.name}
            </option>
          ))}
        </Select>
        {account && foreign && (
          <ForeignPaymentBlock
            key={`${account.id}-${formKey}-${resets}`}
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
          />
        )}
        {accountId && (
          <AccountFundsHint
            funds={funds[accountId]}
            amount={foreign ? undefined : amount}
            amountCurrency={currency}
          />
        )}
        <Button type="submit" loading={pending}>
          Registrar pago
        </Button>
        <Button type="button" variant="ghost" onClick={cancel} disabled={pending} hint="Borra lo que escribiste en este pago y empieza de nuevo. No guarda nada.">
          Cancelar
        </Button>
        {shown.error && (
          <p className="w-full text-sm text-brand-danger">{shown.error}</p>
        )}
        {dialogs}
      </form>
      {fiscal && (
        <p className="inline-flex items-center gap-1 text-xs text-brand-muted">
          El monto propuesto ya tiene descontadas las retenciones.
          <InfoHint
            text={FIELD_HINTS.paymentAmountNet}
            label="Por qué este monto"
          />
        </p>
      )}
    </div>
  );
}
