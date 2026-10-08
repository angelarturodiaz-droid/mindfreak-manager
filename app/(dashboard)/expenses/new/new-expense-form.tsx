"use client";

import { useState } from "react";
import { useOverdraftConfirmAction } from "@/components/ui/overdraft-confirm";
import { AccountFundsHint } from "@/components/banks/account-funds-hint";
import type { AccountFunds } from "@/features/banks/queries";
import Link from "next/link";
import { createExpenseAction, type ActionState } from "@/features/expenses/actions";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@/features/payments/schema";
import { Input, Select } from "@/components/ui/field";
import { SearchSelect } from "@/components/ui/search-select";
import { MoneyInput } from "@/components/ui/money-input";
import { CurrencyExchangeFields } from "@/components/ui/currency-exchange-fields";
import { AccountPicker } from "@/components/payments/account-picker";
import { Button } from "@/components/ui/button";
import { todayISO } from "@/lib/utils/dates";
import { ExpenseFiscalFields } from "@/components/fiscal/expense-fiscal-fields";
import { ForeignPaymentBlock, type RateHistory } from "@/components/payments/foreign-payment-block";

const initialState: ActionState = { error: null };

type Option = { id: string; name: string };
type SupplierOption = Option & { category_id?: string | null; service_type_id?: string | null };
type ServiceTypeOption = { id: string; name: string; category_id: string; fiscal_classification_id: string | null };
type ProjectOption = { id: string; number: string; name: string };
type Account = { id: string; name: string; bank_name: string | null; type: string; currency: string };

export function NewExpenseForm({
  categories,
  suppliers,
  projects,
  accounts,
  bankCatalog,
  baseCurrency,
  currencies,
  defaultProjectId = "",
  defaultSupplierId = "",
  returnTo = null,
  funds = {},
  serviceTypes = [],
  canSeeRules = false,
  fxContext,
}: {
  categories: Option[];
  suppliers: SupplierOption[];
  projects: ProjectOption[];
  accounts: Account[];
  bankCatalog: Option[];
  baseCurrency: string;
  currencies: string[];
  /** Viene de un proyecto o proveedor: se preselecciona y al guardar/cancelar se vuelve ahí. */
  defaultProjectId?: string;
  defaultSupplierId?: string;
  returnTo?: string | null;
  /** Saldo de cada cuenta, para mostrar cuánto hay disponible en la elegida. */
  funds?: Record<string, AccountFunds>;
  /** Tipos de servicio (para el tratamiento fiscal). */
  serviceTypes?: ServiceTypeOption[];
  canSeeRules?: boolean;
  /** Moneda funcional, tolerancia y tasas de referencia (pago en moneda diferente). */
  fxContext: { functionalCurrency: string; tolerance: number; rates: RateHistory };
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

  // Neto a pagar y moneda (los calcula la tarjeta fiscal) y fecha del gasto,
  // para el bloque "Pago en moneda diferente".
  const [net, setNet] = useState<{ netPayable: number; currency: string } | null>(null);
  const [expenseDate, setExpenseDate] = useState(todayISO());
  const isCard = paymentMethod === "CARD";
  const account = accounts.find((a) => a.id === accountId);
  const docCurrency = net?.currency ?? baseCurrency;
  const foreign = Boolean(account && account.currency !== docCurrency);
  const relevantAccounts = accounts.filter((a) =>
    isCard ? a.type === "CREDIT_CARD" : a.type === "BANK",
  );

  return (
    <form action={formAction} className="max-w-md space-y-4">
      {returnTo && <input type="hidden" name="return_to" value={returnTo} />}
      <Input label="Descripción" name="description" required />
      <Input
        label="Fecha"
        name="expense_date"
        type="date"
        required
        value={expenseDate}
        onChange={(e) => setExpenseDate(e.target.value)}
      />

      <SearchSelect
        label="Categoría"
        name="category_id"
        value={categoryId}
        onChange={(v) => {
          setCategoryId(v);
          setCategoryTouched(true);
          setSuggestedFrom(null);
        }}
        emptyLabel="Sin categoría"
        options={categories.map((c) => ({ value: c.id, label: c.name }))}
        hint={suggestedFrom ? `Sugerida por el proveedor ${suggestedFrom}. Puedes cambiarla.` : undefined}
      />

      <SearchSelect
        label="Proveedor"
        name="supplier_id"
        defaultValue={defaultSupplierId}
        emptyLabel="Sin proveedor (gasto general)"
        placeholder="Escribe el nombre del proveedor…"
        options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
        onChange={(v) => {
          const supplier = suppliers.find((s) => s.id === v);
          if (!categoryTouched && supplier?.category_id) {
            setCategoryId(supplier.category_id);
            setSuggestedFrom(supplier.name);
          } else if (!categoryTouched) {
            setCategoryId("");
            setSuggestedFrom(null);
          }
        }}
      />

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

      <CurrencyExchangeFields
        markMissing={state.field === "rate"}
        baseCurrency={baseCurrency}
        currencies={currencies}
        rates={fxContext.rates}
      />

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
        hint="Tarjeta muestra tus tarjetas de crédito; los demás métodos, tus cuentas de banco."
      >
        <option value="">Sin especificar</option>
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
          documentCurrency={docCurrency}
          value={accountId}
          onChange={setAccountId}
          label={isCard ? "Tarjeta (opcional)" : "Banco (opcional)"}
          emptyOptionLabel="Aún no — queda pendiente de pago"
          hint={
            accountId
              ? isCard
                ? "El gasto queda pagado de inmediato (por el neto, si hay retenciones) y sube la deuda de la tarjeta."
                : "El gasto queda pagado de inmediato por el neto a pagar."
              : 'Déjalo en "Aún no" si lo vas a pagar después (en Registrar pago), total o en partes.'
          }
        />
      )}
      {paymentMethod !== "" && relevantAccounts.length === 0 && isCard && (
        <p className="text-sm text-brand-danger">
          Todavía no tienes ninguna tarjeta de crédito creada —{" "}
          <Link href="/banks/new" className="underline">
            crea una primero
          </Link>
          .
        </p>
      )}

      {accountId && <AccountFundsHint funds={funds[accountId]} />}

      {account && foreign && (
        <ForeignPaymentBlock
          key={account.id}
          documentCurrency={docCurrency}
          accountCurrency={account.currency}
          accountName={account.name}
          functionalCurrency={fxContext.functionalCurrency}
          applied={net?.netPayable ?? 0}
          date={expenseDate}
          rates={fxContext.rates}
          tolerance={fxContext.tolerance}
          markMissing={state.field === "fx"}
          missingKey={state}
        />
      )}

      <ExpenseFiscalFields
        serviceTypes={serviceTypes}
        categories={categories}
        suppliers={suppliers}
        defaults={{ supplierId: defaultSupplierId }}
        canSeeRules={canSeeRules}
        onPreview={setNet}
      />

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
