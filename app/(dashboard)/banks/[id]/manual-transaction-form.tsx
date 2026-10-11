"use client";

import { useState } from "react";
import { useOverdraftConfirmAction } from "@/components/ui/overdraft-confirm";
import Link from "next/link";
import { Plus } from "lucide-react";
import { createManualTransactionAction, type ActionState } from "@/features/banks/actions";
import { Input, Select } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { Button } from "@/components/ui/button";
import { todayISO } from "@/lib/utils/dates";
import { FIELD_HINTS } from "@/lib/ui/field-hints";
import { rateOn, type RateHistory } from "@/components/payments/foreign-payment-block";
import { RATE_SOURCE_LABELS, type RateSource } from "@/features/currencies/schema";

const initialState: ActionState = { error: null };

export function ManualTransactionForm({
  bankAccountId,
  categories,
  accountCurrency,
  baseCurrency,
  feeLinks = [],
  rates = {},
}: {
  bankAccountId: string;
  /** Moneda de la cuenta; si no es la moneda base se pide la tasa. */
  accountCurrency: string;
  baseCurrency: string;
  /** Catálogo de Configuración > Categorías (mismo para ingresos y egresos). */
  categories: { id: string; name: string }[];
  /** Pagos, cobros y transferencias recientes de esta cuenta, para ligar una comisión ("tipo:id"). */
  feeLinks?: { value: string; label: string }[];
  /** Tasas de referencia (Configuración → Monedas y tasas) para llenar la tasa sola. */
  rates?: RateHistory;
}) {
  const createWithId = createManualTransactionAction.bind(null, bankAccountId);
  // Éxito: aviso corto y el formulario queda en blanco (key). Sin fondos: ventana.
  const [state, formAction, pending, dialogs, formKey] = useOverdraftConfirmAction(createWithId, initialState, {
    successAs: "toast",
  });
  const [type, setType] = useState("INCOME");
  const [date, setDate] = useState(todayISO());
  // null = no la escribió: se usa la tasa de referencia de la fecha del movimiento.
  const [rateTyped, setRateTyped] = useState<string | null>(null);
  const [seenKey, setSeenKey] = useState(formKey);
  if (seenKey !== formKey) {
    setSeenKey(formKey);
    setType("INCOME");
    setDate(todayISO());
    setRateTyped(null);
  }
  const foreign = accountCurrency !== baseCurrency;
  const found = foreign ? rateOn(rates, accountCurrency, date) : null;
  const rate = rateTyped ?? (found ? String(found.rate) : "");

  return (
    <form key={formKey} action={formAction} className="flex flex-wrap items-end gap-2">
      <Select label="Tipo" name="type" value={type} onChange={(e) => setType(e.target.value)}>
        <option value="INCOME">Ingreso</option>
        <option value="EXPENSE">Gasto</option>
      </Select>
      <Input
        label="Fecha"
        name="transaction_date"
        type="date"
        required
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />
      <MoneyInput label="Monto" name="amount" min={0.01} required defaultValue={0} className="w-28" />
      <Select label="Categoría" name="category_id" defaultValue="" className="w-56">
        <option value="">Sin categoría (clasificar después)</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>
      <Input
        label="Detalle"
        name="description"
        placeholder="Requerido sin categoría"
        className="w-56"
      />
      <Input label="Referencia" name="reference" placeholder="Cheque / No. transacción" className="w-44" />
      {foreign && (
        <Input
          label={`Tasa (1 ${accountCurrency} = ? ${baseCurrency})`}
          name="exchange_rate"
          type="number"
          step="0.000001"
          value={rate}
          onChange={(e) => setRateTyped(e.target.value)}
          placeholder="Ej. 58.80"
          className="w-48"
          info={`Para convertir este movimiento a ${baseCurrency} en los reportes. Se llena sola con la tasa de referencia de la fecha (Configuración → Monedas y tasas) y la puedes cambiar.`}
          hint={
            found
              ? `${RATE_SOURCE_LABELS[found.source as RateSource] ?? found.source} · ${found.date}${rateTyped !== null && Number(rateTyped) !== found.rate ? " · cambiada a mano" : ""}`
              : `No hay tasa de ${accountCurrency} registrada para esa fecha: escríbela.`
          }
        />
      )}
      {type === "EXPENSE" && feeLinks.length > 0 && (
        <Select
          label="¿Comisión de una operación? (opcional)"
          name="related"
          defaultValue=""
          className="w-72"
          info={FIELD_HINTS.feeLink}
          hint="Si el banco cobró después una comisión por un pago, cobro o transferencia."
        >
          <option value="">No, es un gasto suelto</option>
          {feeLinks.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </Select>
      )}
      <Button type="submit" loading={pending} icon={<Plus size={14} />}>
        Agregar movimiento
      </Button>
      {state.error && <p className="w-full text-sm text-brand-danger">{state.error}</p>}
      {dialogs}
      <p className="w-full text-xs text-brand-muted">
        ¿Falta una categoría?{" "}
        <Link href="/settings/expense-categories" className="text-brand-accent hover:underline">
          Administrar categorías
        </Link>
      </p>
    </form>
  );
}
