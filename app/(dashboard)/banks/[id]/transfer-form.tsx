"use client";

import { useActionState, useState } from "react";
import { ArrowRightLeft } from "lucide-react";
import { createTransferAction, type ActionState } from "@/features/banks/actions";
import { Input, Select } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { Button } from "@/components/ui/button";
import { todayISO } from "@/lib/utils/dates";

const initialState: ActionState = { error: null };

type Account = { id: string; name: string; bank_name: string | null; currency: string; type: string };

function fmt(amount: number, currency: string) {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency }).format(amount);
}

export function TransferForm({
  fromAccountId,
  fromCurrency,
  baseCurrency,
  otherAccounts,
}: {
  fromAccountId: string;
  /** Moneda de la cuenta de origen. */
  fromCurrency: string;
  /** Moneda base de la empresa (la tasa se expresa en esta moneda). */
  baseCurrency: string;
  otherAccounts: Account[];
}) {
  const createWithId = createTransferAction.bind(null, fromAccountId);
  const [state, formAction, pending] = useActionState(createWithId, initialState);
  const [toId, setToId] = useState("");
  const [amount, setAmount] = useState(0);
  const [rate, setRate] = useState(0);

  if (otherAccounts.length === 0) {
    return (
      <p className="text-sm text-brand-muted">
        Necesitas al menos otra cuenta o tarjeta activa para poder transferir. Créala en Bancos →
        Nueva cuenta o tarjeta.
      </p>
    );
  }

  const to = otherAccounts.find((a) => a.id === toId);
  const needsRate = Boolean(to && to.currency !== fromCurrency);
  const foreign = to ? (fromCurrency === baseCurrency ? to.currency : fromCurrency) : "";
  // Tasa = unidades de moneda base por 1 unidad de la otra moneda.
  const received =
    needsRate && to && rate > 0 && amount > 0
      ? fromCurrency === baseCurrency
        ? Math.round((amount / rate) * 100) / 100
        : Math.round(amount * rate * 100) / 100
      : null;

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <Select
        label="Cuenta destino"
        name="to_bank_account_id"
        required
        value={toId}
        onChange={(e) => setToId(e.target.value)}
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
      <Input label="Fecha" name="transaction_date" type="date" required defaultValue={todayISO()} />
      <MoneyInput
        label={`Monto que sale (${fromCurrency})`}
        name="amount"
        min={0.01}
        required
        defaultValue={0}
        className="w-32"
        onValueChange={setAmount}
      />
      {needsRate && (
        <Input
          label={`Tasa (${baseCurrency} por 1 ${foreign})`}
          name="exchange_rate"
          type="number"
          step="0.0001"
          min={0.0001}
          required
          placeholder="Ej. 59.50"
          className="w-40"
          onChange={(e) => setRate(Number(e.target.value) || 0)}
        />
      )}
      <Input label="Descripción" name="description" placeholder="Opcional" className="w-48" />
      <Button type="submit" loading={pending} icon={<ArrowRightLeft size={14} />}>
        Transferir
      </Button>
      {needsRate && to && (
        <p className="w-full rounded-[var(--radius-md)] bg-brand-accent-light px-3 py-2 text-sm text-brand-text">
          {received !== null ? (
            <>
              Sale <strong>{fmt(amount, fromCurrency)}</strong> y entran{" "}
              <strong>{fmt(received, to.currency)}</strong> en {to.name}.
            </>
          ) : (
            <>Monedas distintas ({fromCurrency} → {to.currency}): indica el monto y la tasa del banco.</>
          )}
        </p>
      )}
      {state.error && <p className="w-full text-sm text-brand-danger">{state.error}</p>}
    </form>
  );
}
