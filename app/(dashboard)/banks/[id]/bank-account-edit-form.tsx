"use client";

import { useActionState } from "react";
import { updateBankAccountAction, type ActionState } from "@/features/banks/actions";
import { Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

const initialState: ActionState = { error: null };

export function BankAccountEditForm({
  account,
  canEditOpeningBalance,
  bankCatalog,
}: {
  account: {
    id: string;
    name: string;
    bank_name: string | null;
    account_number_masked: string | null;
    type: string;
    credit_limit: number | null;
    opening_balance: number;
    opening_balance_date: string;
  };
  canEditOpeningBalance: boolean;
  bankCatalog: { id: string; name: string }[];
}) {
  const updateWithId = updateBankAccountAction.bind(null, account.id);
  const [state, formAction, pending] = useActionState(updateWithId, initialState);
  const isCard = account.type === "CREDIT_CARD";

  return (
    <form action={formAction} className="max-w-md space-y-4">
      <Input label="Nombre" name="name" defaultValue={account.name} required />
      <Select label="Banco" name="bank_name" defaultValue={account.bank_name ?? ""}>
        <option value="">Selecciona un banco…</option>
        {account.bank_name && !bankCatalog.some((b) => b.name === account.bank_name) && (
          <option value={account.bank_name}>{account.bank_name} (no está en el catálogo)</option>
        )}
        {bankCatalog.map((b) => (
          <option key={b.id} value={b.name}>
            {b.name}
          </option>
        ))}
      </Select>
      <Input
        label="Número (enmascarado)"
        name="account_number_masked"
        defaultValue={account.account_number_masked ?? ""}
      />

      {isCard && (
        <Input
          label="Límite de crédito"
          name="credit_limit"
          type="number"
          step="0.01"
          min="0"
          defaultValue={account.credit_limit ?? ""}
          placeholder="Opcional"
          hint="Puedes actualizarlo cuando el banco te suba o baje el límite."
        />
      )}

      <div className="grid grid-cols-2 gap-3">
        <Input
          label={isCard ? "Deuda inicial" : "Balance inicial"}
          name="opening_balance"
          type="number"
          step="0.01"
          defaultValue={isCard ? Math.abs(account.opening_balance) : account.opening_balance}
          disabled={!canEditOpeningBalance}
          hint={
            !canEditOpeningBalance
              ? "Bloqueado: esta cuenta ya tiene movimientos registrados."
              : undefined
          }
        />
        <Input
          label={isCard ? "Fecha de la deuda inicial" : "Fecha del balance inicial"}
          name="opening_balance_date"
          type="date"
          defaultValue={account.opening_balance_date}
          disabled={!canEditOpeningBalance}
        />
      </div>

      {state.error && <p className="text-sm text-brand-danger">{state.error}</p>}

      <Button type="submit" loading={pending}>
        Guardar cambios
      </Button>
    </form>
  );
}
