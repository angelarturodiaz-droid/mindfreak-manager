"use client";

import { useState } from "react";
import { useOverdraftConfirmAction } from "@/components/ui/overdraft-confirm";
import { registerPaymentAction, type ActionState } from "@/features/payments/actions";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@/features/payments/schema";
import { Input, Select } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { Button } from "@/components/ui/button";
import { todayISO } from "@/lib/utils/dates";
import { AccountPicker } from "@/components/payments/account-picker";
import { ForeignPaymentBlock, type RateHistory } from "@/components/payments/foreign-payment-block";

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
}) {
  const registerWithIds = registerPaymentAction.bind(null, invoiceId, clientId, projectId);
  // Ventana verde al terminar, roja si el monto pasa de lo pendiente.
  const [state, formAction, pending, dialogs, formKey] = useOverdraftConfirmAction(registerWithIds, initialState);
  // Por defecto "Cobro de factura" (lo mismo que pone el sistema si no se elige nada).
  const defaultCategory = categories.find((c) => normalize(c.name) === "cobro de factura");

  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState(balance);
  const [paymentDate, setPaymentDate] = useState(todayISO());
  // Después de un cobro exitoso, o con "Cancelar", el formulario vuelve a empezar.
  const [seenKey, setSeenKey] = useState(formKey);
  const [resets, setResets] = useState(0);
  const [clearedState, setClearedState] = useState<ActionState | null>(null);
  function restart() {
    setAccountId("");
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
  // Cuenta en otra moneda que la factura → bloque "Cobro en moneda diferente".
  const foreign = Boolean(account && account.currency !== currency);

  return (
    <form key={`${formKey}-${resets}`} action={formAction} className="flex flex-wrap items-end gap-2">
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
        hint={`Máx. ${balance.toFixed(2)} ${currency}`}
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
      <AccountPicker
        accounts={bankAccounts}
        kind="bank"
        documentCurrency={currency}
        value={accountId}
        onChange={setAccountId}
        label="Cuenta bancaria"
      />
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
      <Input label="Referencia" name="reference" />
      {account && foreign && (
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
        />
      )}
      <Button type="submit" loading={pending}>
        Registrar cobro
      </Button>
      <Button type="button" variant="ghost" onClick={cancel} disabled={pending} hint="Borra lo que escribiste en este cobro y empieza de nuevo. No guarda nada.">
        Cancelar
      </Button>
      {shown.error && <p className="w-full text-sm text-brand-danger">{shown.error}</p>}
      {dialogs}
    </form>
  );
}
