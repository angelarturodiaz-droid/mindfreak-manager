"use client";

import { useState } from "react";
import { useOverdraftConfirmAction } from "@/components/ui/overdraft-confirm";
import { AccountFundsHint } from "@/components/banks/account-funds-hint";
import type { AccountFunds } from "@/features/banks/queries";
import Link from "next/link";
import { createExpenseAction, type ActionState } from "@/features/expenses/actions";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@/features/payments/schema";
import { Input, Select } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { CurrencyExchangeFields } from "@/components/ui/currency-exchange-fields";
import { Button } from "@/components/ui/button";
import { todayISO } from "@/lib/utils/dates";

const initialState: ActionState = { error: null };

type Option = { id: string; name: string };
type SupplierOption = Option & { category_id?: string | null };
type ProjectOption = { id: string; number: string; name: string };
type Account = { id: string; name: string; bank_name: string | null; type: string };

export function NewExpenseForm({
  categories,
  suppliers,
  projects,
  accounts,
  bankCatalog,
  baseCurrency,
  defaultProjectId = "",
  defaultSupplierId = "",
  returnTo = null,
  funds = {},
}: {
  categories: Option[];
  suppliers: SupplierOption[];
  projects: ProjectOption[];
  accounts: Account[];
  bankCatalog: Option[];
  baseCurrency: string;
  /** Viene de un proyecto o proveedor: se preselecciona y al guardar/cancelar se vuelve ahí. */
  defaultProjectId?: string;
  defaultSupplierId?: string;
  returnTo?: string | null;
  /** Saldo de cada cuenta, para mostrar cuánto hay disponible en la elegida. */
  funds?: Record<string, AccountFunds>;
}) {
  const [state, formAction, pending, dialogs] = useOverdraftConfirmAction(createExpenseAction, initialState);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [accountId, setAccountId] = useState("");
  // Categoría sugerida por el proveedor: se llena sola al elegirlo, salvo
  // que el usuario ya haya elegido una a mano.
  const defaultSupplier = suppliers.find((s) => s.id === defaultSupplierId);
  const [categoryId, setCategoryId] = useState(defaultSupplier?.category_id ?? "");
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [suggestedFrom, setSuggestedFrom] = useState<string | null>(
    defaultSupplier?.category_id ? defaultSupplier.name : null,
  );

  const isCard = paymentMethod === "CARD";
  const relevantAccounts = accounts.filter((a) =>
    isCard ? a.type === "CREDIT_CARD" : a.type === "BANK",
  );

  return (
    <form action={formAction} className="max-w-md space-y-4">
      {returnTo && <input type="hidden" name="return_to" value={returnTo} />}
      <Input label="Descripción" name="description" required />
      <Input label="Fecha" name="expense_date" type="date" required defaultValue={todayISO()} />

      <Select
        label="Categoría"
        name="category_id"
        value={categoryId}
        onChange={(e) => {
          setCategoryId(e.target.value);
          setCategoryTouched(true);
          setSuggestedFrom(null);
        }}
        hint={suggestedFrom ? `Sugerida por el proveedor ${suggestedFrom}. Puedes cambiarla.` : undefined}
      >
        <option value="">Sin categoría</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>

      <Select
        label="Proveedor"
        name="supplier_id"
        defaultValue={defaultSupplierId}
        onChange={(e) => {
          const supplier = suppliers.find((s) => s.id === e.target.value);
          if (!categoryTouched && supplier?.category_id) {
            setCategoryId(supplier.category_id);
            setSuggestedFrom(supplier.name);
          } else if (!categoryTouched) {
            setCategoryId("");
            setSuggestedFrom(null);
          }
        }}
      >
        <option value="">Sin proveedor (gasto general)</option>
        {suppliers.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </Select>

      <Select
        label="Banco del proveedor (opcional)"
        name="payee_bank_name"
        defaultValue=""
        hint="A qué banco se le deposita a él. No es la cuenta desde la que tú pagas."
      >
        <option value="">Sin especificar</option>
        {bankCatalog.map((b) => (
          <option key={b.id} value={b.name}>
            {b.name}
          </option>
        ))}
      </Select>

      <Select label="Proyecto/Evento" name="project_id" defaultValue={defaultProjectId}>
        <option value="">Sin proyecto (gasto general de la empresa)</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.number} — {p.name}
          </option>
        ))}
      </Select>

      <div className="grid grid-cols-2 gap-3">
        <MoneyInput label="Subtotal" name="subtotal" min={0} required defaultValue={0} />
        <Input label="Impuesto (%)" name="tax_percent" type="number" step="0.01" min="0" defaultValue="18" />
      </div>

      <Select
        label="Método de pago"
        name="payment_method"
        defaultValue=""
        onChange={(e) => {
          setPaymentMethod(e.target.value);
          setAccountId("");
        }}
      >
        <option value="">Sin especificar</option>
        {PAYMENT_METHODS.map((m) => (
          <option key={m} value={m}>
            {PAYMENT_METHOD_LABELS[m]}
          </option>
        ))}
      </Select>

      {isCard ? (
        <>
          <Select
            label="Tarjeta"
            name="bank_account_id"
            required
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            hint="El gasto queda pagado de inmediato y la deuda de la tarjeta sube sola."
          >
            <option value="" disabled>
              Selecciona una tarjeta…
            </option>
            {relevantAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} {a.bank_name ? `(${a.bank_name})` : ""}
              </option>
            ))}
          </Select>
          {relevantAccounts.length === 0 && (
            <p className="text-sm text-brand-danger">
              Todavía no tienes ninguna tarjeta de crédito creada —{" "}
              <Link href="/banks/new" className="underline">
                crea una primero
              </Link>
              .
            </p>
          )}
        </>
      ) : (
        paymentMethod !== "" && (
          <Select
            label="Banco (opcional)"
            name="bank_account_id"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            hint={
              relevantAccounts.length === 0
                ? "Sin cuentas bancarias todavía — se puede pagar después desde el detalle del gasto."
                : "Si ya sabes desde qué banco se pagó, el gasto queda pagado de inmediato. Si no, déjalo en blanco y lo pagas después."
            }
          >
            <option value="">Aún no lo sé (queda pendiente de pago)</option>
            {relevantAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} {a.bank_name ? `(${a.bank_name})` : ""}
              </option>
            ))}
          </Select>
        )
      )}

      {accountId && <AccountFundsHint funds={funds[accountId]} />}

      <CurrencyExchangeFields baseCurrency={baseCurrency} />

      {state.error && <p className="text-sm text-brand-danger">{state.error}</p>}

      {dialogs}

      <div className="flex gap-3">
        <Button type="submit" loading={pending}>
          Crear gasto
        </Button>
        <Link href={returnTo ?? "/expenses"}>
          <Button type="button" variant="ghost">
            Cancelar
          </Button>
        </Link>
      </div>
    </form>
  );
}
