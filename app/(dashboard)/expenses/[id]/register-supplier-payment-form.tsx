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

const initialState: ActionState = { error: null };

type BankAccount = {
  id: string;
  name: string;
  bank_name: string | null;
  currency: string;
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
  const [amount, setAmount] = useState(balance);
  const [paymentDate, setPaymentDate] = useState(todayISO());
  // Después de un pago exitoso el formulario vuelve a empezar.
  const [seenKey, setSeenKey] = useState(formKey);
  if (seenKey !== formKey) {
    setSeenKey(formKey);
    setAccountId("");
    setAmount(balance);
    setPaymentDate(todayISO());
  }
  const account = bankAccounts.find((b) => b.id === accountId);
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
        key={formKey}
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
        <Select label="Método" name="method" defaultValue="TRANSFER">
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {PAYMENT_METHOD_LABELS[m]}
            </option>
          ))}
        </Select>
        <Select
          label="Cuenta bancaria"
          name="bank_account_id"
          required
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
        >
          <option value="" disabled>
            Selecciona una cuenta…
          </option>
          {bankAccounts.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} ({b.bank_name}){b.currency !== currency ? ` · ${b.currency}` : ""}
            </option>
          ))}
        </Select>
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
            key={`${account.id}-${formKey}`}
            documentCurrency={currency}
            accountCurrency={account.currency}
            accountName={account.name}
            functionalCurrency={fxContext.functionalCurrency}
            applied={amount}
            date={paymentDate}
            rates={fxContext.rates}
            tolerance={fxContext.tolerance}
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
        {state.error && (
          <p className="w-full text-sm text-brand-danger">{state.error}</p>
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
