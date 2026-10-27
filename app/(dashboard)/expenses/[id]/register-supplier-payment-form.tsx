"use client";

import Link from "next/link";
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
import { FormSection, FormFooter } from "@/components/payments/form-section";
import { CancelConfirm } from "@/components/payments/cancel-confirm";

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
  fiscalMissing = [],
  fiscalRule = null,
  fxContext,
  defaultMethod,
  recipientName = null,
}: {
  /** V1-2: incentivo sin proveedor → a quién se le paga (cambia los textos del paso 3). */
  recipientName?: string | null;
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
  /** Lo que falta para evaluar (del cálculo fiscal guardado), para el aviso. */
  fiscalMissing?: string[];
  /** Regla que pidió revisión (estado "Por revisar"). */
  fiscalRule?: { id?: string; name: string } | null;
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
        <div className="rounded-[var(--radius-md)] bg-brand-warning-bg px-3 py-2 text-xs text-brand-warning">
          {fiscalStatus === "MISSING_DATA" ? (
            <>
              <strong>Faltan datos fiscales</strong>
              {fiscalMissing.length > 0 && <>: {fiscalMissing.map((m) => m.replace(/\.$/, "").replace(/^Falta definir /, "")).join("; ")}</>}. Si pagas ahora
              se le paga el total, sin retenciones. Si le corresponde retención,{" "}
              {supplierId ? (
                <Link href={`/suppliers/${supplierId}`} target="_blank" className="font-medium underline">
                  completa la ficha del proveedor
                </Link>
              ) : (
                "completa los datos"
              )}{" "}
              y pulsa “Recalcular” en la tarjeta Tratamiento fiscal <strong>antes</strong> del primer pago.
            </>
          ) : fiscalStatus === "NO_RULE" ? (
            <>
              <strong>Ninguna regla fiscal aplica</strong> a este gasto. Revísalo con tu contador antes de pagar;
              si pagas ahora se le paga el total, sin retenciones. Si hace falta una regla, se crea en
              Configuración → Reglas fiscales y luego se pulsa “Recalcular”.
            </>
          ) : (
            <>
              <strong>Los datos están completos</strong>, pero la regla
              {fiscalRule ? (
                <>
                  {" "}
                  {fiscalRule.id ? (
                    <Link href={`/settings/fiscal-rules/${fiscalRule.id}`} target="_blank" className="font-medium underline">
                      «{fiscalRule.name}»
                    </Link>
                  ) : (
                    <>«{fiscalRule.name}»</>
                  )}
                </>
              ) : null}{" "}
              pide que alguien revise este caso antes de pagar (ver “¿Por qué se aplicó esto?” en la tarjeta
              Tratamiento fiscal). <strong>No hace falta recalcular.</strong> Si pagas ahora se le paga el total, sin
              retenciones.
            </>
          )}
        </div>
      )}
      <form
        key={`${formKey}-${resets}`}
        action={formAction}
        className="space-y-5"
      >
        <FormSection step={1} title="Datos del pago">
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
                : `Máx. ${formatMoney(balance, currency)}`
            }
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
          <div className="sm:col-span-3">
            {amount > 0 && amount < balance - 0.005 ? (
              <p className="rounded-[var(--radius-md)] border border-brand-accent/25 bg-brand-accent-light px-3 py-2 text-xs text-brand-text" role="status">
                <strong>Pago parcial:</strong> el gasto quedará en <em>Pago parcial</em> y faltará por pagar{" "}
                <strong>{formatMoney(Math.round((balance - amount) * 100) / 100, currency)}</strong>. Así se registra un{" "}
                <strong>anticipo al proveedor</strong>: cuando le pagues el resto, vuelve aquí y registra otro pago.
                {fiscal ? " Los pagos son contra el neto: las retenciones se calcularon sobre el total del gasto y no cambian." : ""}
              </p>
            ) : (
              <p className="inline-flex items-center gap-1 text-xs text-brand-muted">
                ¿Le vas a adelantar dinero al proveedor? Escribe aquí solo el adelanto.
                <InfoHint text="Anticipo a proveedor: el gasto se registra por el monto TOTAL acordado (ej. RD$100,000) y aquí se paga solo lo que le adelantas (ej. RD$40,000). El gasto queda en «Pago parcial» con lo que falta por pagar, y cuando le pagues el resto registras otro pago. Su factura (NCF) la adjuntas en Recibos y comprobantes cuando llegue. Los anticipos a proveedores con su propio documento quedan para la versión 2." />
              </p>
            )}
          </div>
        </FormSection>

        <FormSection step={2} title={isCard ? "Tarjeta con que se paga" : "Cuenta de donde sale el dinero"} cols={2}>
          <AccountPicker
            accounts={bankAccounts}
            kind={isCard ? "card" : "bank"}
            documentCurrency={currency}
            value={accountId}
            onChange={setAccountId}
            hint={isCard ? "El pago sube la deuda de la tarjeta." : undefined}
          />
          <Input label="Referencia" name="reference" placeholder="Opcional (ej. número de transferencia)" />
          {account && foreign && (
            <div className="sm:col-span-2">
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
            </div>
          )}
          {accountId && (
            <div className="sm:col-span-2">
              <AccountFundsHint
                funds={funds[accountId]}
                amount={foreign ? undefined : amount}
                amountCurrency={currency}
              />
            </div>
          )}
        </FormSection>

        <FormSection step={3} title={recipientName ? `A quién se le paga: ${recipientName} (opcional)` : "Proveedor (opcional)"} cols={2}>
          <Select
            label={recipientName ? "Banco de quien recibe" : "Banco del proveedor"}
            name="payee_bank_name"
            defaultValue=""
            hint={recipientName ? "A dónde se le depositó a esa persona, no tu cuenta de origen." : "A dónde se le depositó a él, no tu cuenta de origen."}
          >
            <option value="">Sin especificar</option>
            {bankCatalog.map((b) => (
              <option key={b.id} value={b.name}>
                {b.name}
              </option>
            ))}
          </Select>
        </FormSection>

        <FormFooter error={shown.error}>
          <CancelConfirm what="pago" backHref="/expenses" backLabel="Gastos" onDiscard={cancel} disabled={pending} />
          <Button type="submit" loading={pending}>
            Registrar pago
          </Button>
        </FormFooter>
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
