"use client";

import { useState } from "react";
import Link from "next/link";
import { useOverdraftConfirmAction } from "@/components/ui/overdraft-confirm";
import { AccountFundsHint } from "@/components/banks/account-funds-hint";
import type { AccountFunds } from "@/features/banks/queries";
import { createIncentiveAction } from "@/features/incentives/actions";
import type { MoneyActionState } from "@/lib/utils/bank-errors";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@/features/payments/schema";
import { Input, Select } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { AccountPicker } from "@/components/payments/account-picker";
import { Button } from "@/components/ui/button";
import { InfoHint } from "@/components/ui/info-hint";
import { todayISO } from "@/lib/utils/dates";

const initialState: MoneyActionState = { error: null };
type Account = { id: string; name: string; bank_name: string | null; type: string; currency: string };

const fmt = (n: number) => new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP" }).format(n);

export function NewIncentiveForm({
  projectId,
  projectNumber,
  base,
  ventas,
  gastos,
  accounts,
  funds,
  returnTo,
}: {
  projectId: string;
  projectNumber: string;
  /** Ganancia antes de incentivos de hoy (ventas sin ITBIS − gastos sin ITBIS). */
  base: number;
  ventas: number;
  gastos: number;
  accounts: Account[];
  funds: Record<string, AccountFunds>;
  returnTo: string;
}) {
  const [state, formAction, pending, dialogs] = useOverdraftConfirmAction(createIncentiveAction, initialState);
  const [recipient, setRecipient] = useState("");
  const [type, setType] = useState<"EMPLOYEE" | "THIRD_PARTY">("EMPLOYEE");
  const [reason, setReason] = useState("");
  const [mode, setMode] = useState<"FIXED" | "PERCENT">("FIXED");
  const [percent, setPercent] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [accountId, setAccountId] = useState("");
  const isCard = paymentMethod === "CARD";

  const pct = Number(percent);
  const calc = mode === "PERCENT" && pct > 0 && pct <= 100 && base > 0 ? Math.round(base * pct) / 100 : null;
  const preview = `Incentivo por proyecto – ${recipient.trim() || "…"} (${type === "EMPLOYEE" ? "empleado" : "tercero"}) – ${
    reason.trim() || "…"
  } – ${projectNumber}`;

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="return_to" value={returnTo} />

      <Input
        label="¿Para quién?"
        name="recipient"
        required
        value={recipient}
        onChange={(e) => setRecipient(e.target.value)}
        placeholder="Ej. María Rodríguez"
        info="Nombre de la persona que recibe el incentivo. No hace falta crearla como proveedor."
        error={state.field === "recipient" ? state.error ?? undefined : undefined}
      />
      <Select
        label="Es"
        name="recipient_type"
        value={type}
        onChange={(e) => setType(e.target.value as "EMPLOYEE" | "THIRD_PARTY")}
        info="Empleado: trabaja en la empresa (se le paga aparte de la nómina, para no contarlo dos veces). Tercero: alguien de fuera (ej. quien refirió el evento)."
      >
        <option value="EMPLOYEE">Empleado</option>
        <option value="THIRD_PARTY">Tercero</option>
      </Select>
      <Input
        label="Motivo"
        name="reason"
        required
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Ej. coordinación del evento"
        info="Por qué se le paga. Sale en la descripción del gasto."
      />

      <Select
        label="¿Cómo se calcula?"
        name="mode"
        value={mode}
        onChange={(e) => setMode(e.target.value as "FIXED" | "PERCENT")}
        info="Monto fijo: escribes cuánto. Por %: un porcentaje de la ganancia del proyecto antes de incentivos (lo vendido menos lo gastado, sin ITBIS)."
      >
        <option value="FIXED">Monto fijo</option>
        <option value="PERCENT">% de la ganancia antes de incentivos</option>
      </Select>

      {mode === "FIXED" ? (
        <MoneyInput
          label="Monto (RD$)"
          name="amount"
          required
          hint="Lo que recibe la persona. Sin ITBIS ni retenciones."
          error={state.field === "amount" ? state.error ?? undefined : undefined}
        />
      ) : (
        <div className="space-y-2">
          <Input
            label="Porcentaje (%)"
            name="percent"
            type="number"
            step="any"
            min="0.01"
            max="100"
            required
            value={percent}
            onChange={(e) => setPercent(e.target.value)}
            info="Ej. 10 = el 10 % de la ganancia antes de incentivos."
            error={state.field === "percent" ? state.error ?? undefined : undefined}
          />
          <div className="rounded-[var(--radius-md)] border border-brand-border bg-brand-surface-hover px-3 py-2 text-sm">
            <p className="flex items-center gap-1 font-medium text-brand-text">
              Ganancia antes de incentivos: {fmt(base)}
              <InfoHint text={`Ventas sin ITBIS ${fmt(ventas)} − gastos sin ITBIS ${fmt(gastos)} (sin contar los incentivos). Se guarda junto al incentivo para saber de dónde salió el monto.`} />
            </p>
            {base <= 0 ? (
              <p className="mt-1 text-brand-warning">
                El proyecto todavía no tiene ganancia: no se puede calcular un %. Factura primero o usa un monto fijo.
              </p>
            ) : calc !== null ? (
              <p className="mt-1 text-brand-text">
                {pct} % de {fmt(base)} = <strong>{fmt(calc)}</strong>
              </p>
            ) : (
              <p className="mt-1 text-brand-muted">Escribe el % para ver el monto.</p>
            )}
          </div>
        </div>
      )}

      <Input label="Fecha" name="expense_date" type="date" required defaultValue={todayISO()} />

      <Select
        label="¿Ya se pagó?"
        name="payment_method"
        value={paymentMethod}
        onChange={(e) => {
          setPaymentMethod(e.target.value);
          setAccountId("");
        }}
        info="Si ya se le pagó, elige cómo y desde qué cuenta en pesos: el incentivo queda Pagado y sale del banco. Si no (o si lo vas a pagar desde dólares), déjalo pendiente y págalo después abriendo el incentivo → «Registrar pago», en partes si quieres."
      >
        <option value="">Todavía no — queda pendiente</option>
        {PAYMENT_METHODS.map((m) => (
          <option key={m} value={m}>
            {PAYMENT_METHOD_LABELS[m]}
          </option>
        ))}
      </Select>
      {paymentMethod !== "" && (
        <AccountPicker
          accounts={accounts}
          kind={isCard ? "card" : "bank"}
          documentCurrency="DOP"
          value={accountId}
          onChange={setAccountId}
          label={isCard ? "Tarjeta (en pesos)" : "Cuenta de banco (en pesos)"}
          emptyOptionLabel="Aún no — queda pendiente de pago"
          hint="Solo cuentas en pesos. Para pagar desde una cuenta en dólares (con la conversión y la comisión del banco), déjalo pendiente y luego, en el incentivo, usa «Registrar pago»."
        />
      )}
      {accountId && <AccountFundsHint funds={funds[accountId]} />}

      <p className="rounded-[var(--radius-md)] bg-brand-accent-light px-3 py-2 text-xs text-brand-text">
        <span className="font-medium">Así se verá en el gasto:</span> {preview}
      </p>

      {state.error && !state.field && <p className="text-sm text-brand-danger">{state.error}</p>}
      {state.error && state.field && state.field !== "recipient" && state.field !== "percent" && state.field !== "amount" && (
        <p className="text-sm text-brand-danger">{state.error}</p>
      )}
      {dialogs}

      <div className="flex gap-3">
        <Button type="submit" loading={pending}>
          Guardar incentivo
        </Button>
        <Link href={returnTo}>
          <Button type="button" variant="ghost">
            Cancelar
          </Button>
        </Link>
      </div>
    </form>
  );
}
