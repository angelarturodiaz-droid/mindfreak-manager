"use client";

import { useState } from "react";
import { useOverdraftConfirmAction } from "@/components/ui/overdraft-confirm";
import { refundAdvanceAction, type AdvanceActionState } from "@/features/advances/actions";
import { Input, Textarea } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { Button } from "@/components/ui/button";
import { AccountPicker } from "@/components/payments/account-picker";
import { AccountFundsHint } from "@/components/banks/account-funds-hint";
import { FormSection, FormFooter } from "@/components/payments/form-section";
import type { AccountFunds } from "@/features/banks/queries";
import { todayISO } from "@/lib/utils/dates";
import { formatMoney } from "@/lib/utils/money";

const initialState: AdvanceActionState = { error: null };
type BankAccount = { id: string; name: string; bank_name: string | null; currency: string; type?: string | null };

/** Devolver al cliente todo o parte de lo disponible (evento cancelado). */
export function RefundAdvanceForm({
  advanceId,
  available,
  currency,
  bankAccounts,
  funds,
}: {
  advanceId: string;
  available: number;
  currency: string;
  bankAccounts: BankAccount[];
  funds: Record<string, AccountFunds>;
}) {
  const [state, formAction, pending, dialogs, formKey] = useOverdraftConfirmAction(
    refundAdvanceAction.bind(null, advanceId),
    initialState,
  );
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState(available);
  const account = bankAccounts.find((b) => b.id === accountId);
  const foreign = Boolean(account && account.currency !== currency);

  return (
    <form key={formKey} action={formAction} className="space-y-4">
      <FormSection step={1} title="¿Cuánto se devuelve?">
        <Input label="Fecha" name="refund_date" type="date" defaultValue={todayISO()} required />
        <MoneyInput
          label={`Monto a devolver (${currency})`}
          name="amount"
          defaultValue={available}
          required
          hint={`Disponible: ${formatMoney(available, currency)}. Puedes devolver solo una parte.`}
          error={amount > available + 0.005 ? "Es más de lo disponible en el anticipo." : undefined}
          onValueChange={setAmount}
        />
      </FormSection>
      <FormSection step={2} title="¿De qué cuenta sale?" cols={2}>
        <AccountPicker
          accounts={bankAccounts}
          kind="bank"
          documentCurrency={currency}
          value={accountId}
          onChange={setAccountId}
          label="Cuenta bancaria"
        />
        {foreign ? (
          <MoneyInput
            label={`¿Cuánto salió de la cuenta? (${account?.currency})`}
            name="account_amount"
            required
            hint="La cuenta está en otra moneda que el anticipo: escribe lo que realmente salió."
          />
        ) : (
          <span />
        )}
        {accountId && (
          <div className="sm:col-span-2">
            <AccountFundsHint funds={funds[accountId]} amount={foreign ? undefined : amount} amountCurrency={currency} />
          </div>
        )}
      </FormSection>
      <FormSection step={3} title="Motivo" cols={2}>
        <div className="sm:col-span-2">
          <Textarea name="reason" rows={2} required placeholder="Ej. El cliente canceló el evento" />
        </div>
      </FormSection>
      <FormFooter error={state.error}>
        <Button type="submit" variant="danger" loading={pending} disabled={!accountId || amount <= 0 || amount > available + 0.005}>
          Registrar devolución
        </Button>
      </FormFooter>
      {dialogs}
    </form>
  );
}
