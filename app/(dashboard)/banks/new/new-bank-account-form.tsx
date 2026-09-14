"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { createBankAccountAction, type ActionState } from "@/features/banks/actions";
import { Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

const initialState: ActionState = { error: null };
const today = new Date().toISOString().slice(0, 10);

export function NewBankAccountForm() {
  const [state, formAction, pending] = useActionState(createBankAccountAction, initialState);
  const [type, setType] = useState<"BANK" | "CREDIT_CARD">("BANK");
  const isCard = type === "CREDIT_CARD";

  return (
    <form action={formAction} className="max-w-md space-y-4">
      <Select
        label="Tipo"
        name="type"
        defaultValue="BANK"
        onChange={(e) => setType(e.target.value as "BANK" | "CREDIT_CARD")}
      >
        <option value="BANK">Cuenta bancaria</option>
        <option value="CREDIT_CARD">Tarjeta de crédito</option>
      </Select>

      <Input
        label="Nombre"
        name="name"
        required
        placeholder={isCard ? "Ej. Visa Banreservas" : "Ej. Cuenta Corriente Banreservas"}
      />
      <Input label="Banco" name="bank_name" />
      <Input
        label="Número (enmascarado)"
        name="account_number_masked"
        placeholder="****1234"
        hint="Nunca se guardan credenciales bancarias/de tarjeta, solo un número de referencia enmascarado."
      />

      <div className="grid grid-cols-2 gap-3">
        <Select label="Moneda" name="currency" defaultValue="DOP">
          <option value="DOP">DOP</option>
          <option value="USD">USD</option>
        </Select>
        <Input
          label={isCard ? "Deuda inicial" : "Balance inicial"}
          name="opening_balance"
          type="number"
          step="0.01"
          min={isCard ? "0" : undefined}
          defaultValue="0"
          hint={isCard ? "Cuánto debes hoy en esta tarjeta (0 si es nueva)." : undefined}
        />
      </div>

      {isCard && (
        <Input
          label="Límite de crédito"
          name="credit_limit"
          type="number"
          step="0.01"
          min="0"
          placeholder="Opcional"
        />
      )}

      <Input
        label={isCard ? "Fecha de la deuda inicial" : "Fecha del balance inicial"}
        name="opening_balance_date"
        type="date"
        required
        defaultValue={today}
      />

      {state.error && <p className="text-sm text-brand-danger">{state.error}</p>}

      <div className="flex gap-3">
        <Button type="submit" loading={pending}>
          {isCard ? "Crear tarjeta" : "Crear cuenta"}
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
