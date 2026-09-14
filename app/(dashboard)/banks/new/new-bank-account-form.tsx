"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createBankAccountAction, type ActionState } from "@/features/banks/actions";
import { Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

const initialState: ActionState = { error: null };
const today = new Date().toISOString().slice(0, 10);

export function NewBankAccountForm() {
  const [state, formAction, pending] = useActionState(createBankAccountAction, initialState);

  return (
    <form action={formAction} className="max-w-md space-y-4">
      <Input label="Nombre" name="name" required placeholder="Ej. Cuenta Corriente Banreservas" />
      <Input label="Banco" name="bank_name" />
      <Input
        label="Número de cuenta (enmascarado)"
        name="account_number_masked"
        placeholder="****1234"
        hint="Nunca se guardan credenciales bancarias, solo un número de referencia enmascarado."
      />

      <div className="grid grid-cols-2 gap-3">
        <Select label="Moneda" name="currency" defaultValue="DOP">
          <option value="DOP">DOP</option>
          <option value="USD">USD</option>
        </Select>
        <Input label="Balance inicial" name="opening_balance" type="number" step="0.01" defaultValue="0" />
      </div>

      <Input
        label="Fecha del balance inicial"
        name="opening_balance_date"
        type="date"
        required
        defaultValue={today}
      />

      {state.error && <p className="text-sm text-brand-danger">{state.error}</p>}

      <div className="flex gap-3">
        <Button type="submit" loading={pending}>
          Crear cuenta
        </Button>
        <Link href="/banks">
          <Button type="button" variant="ghost">
            Cancelar
          </Button>
        </Link>
      </div>
    </form>
  );
}
