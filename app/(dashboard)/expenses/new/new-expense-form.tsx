"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { createExpenseAction, type ActionState } from "@/features/expenses/actions";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@/features/payments/schema";
import { Input, Select } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { Button } from "@/components/ui/button";

const initialState: ActionState = { error: null };
const today = new Date().toISOString().slice(0, 10);

type Option = { id: string; name: string };
type ProjectOption = { id: string; number: string; name: string };
type Account = { id: string; name: string; bank_name: string | null; type: string };

export function NewExpenseForm({
  categories,
  suppliers,
  projects,
  accounts,
  bankCatalog,
}: {
  categories: Option[];
  suppliers: Option[];
  projects: ProjectOption[];
  accounts: Account[];
  bankCatalog: Option[];
}) {
  const [state, formAction, pending] = useActionState(createExpenseAction, initialState);
  const [paymentMethod, setPaymentMethod] = useState("");

  const isCard = paymentMethod === "CARD";
  const relevantAccounts = accounts.filter((a) =>
    isCard ? a.type === "CREDIT_CARD" : a.type === "BANK",
  );

  return (
    <form action={formAction} className="max-w-md space-y-4">
      <Input label="Descripción" name="description" required />
      <Input label="Fecha" name="expense_date" type="date" required defaultValue={today} />

      <Select label="Categoría" name="category_id" defaultValue="">
        <option value="">Sin categoría</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>

      <Select label="Proveedor" name="supplier_id" defaultValue="">
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

      <Select label="Proyecto/Evento" name="project_id" defaultValue="">
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
        onChange={(e) => setPaymentMethod(e.target.value)}
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
            defaultValue=""
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
            defaultValue=""
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

      <div className="grid grid-cols-2 gap-3">
        <Select label="Moneda" name="currency" defaultValue="DOP">
          <option value="DOP">DOP</option>
          <option value="USD">USD</option>
        </Select>
        <Input
          label="Tasa de cambio"
          name="exchange_rate"
          type="number"
          step="0.000001"
          min="0.000001"
          defaultValue="1"
        />
      </div>

      {state.error && <p className="text-sm text-brand-danger">{state.error}</p>}

      <div className="flex gap-3">
        <Button type="submit" loading={pending}>
          Crear gasto
        </Button>
        <Link href="/expenses">
          <Button type="button" variant="ghost">
            Cancelar
          </Button>
        </Link>
      </div>
    </form>
  );
}
