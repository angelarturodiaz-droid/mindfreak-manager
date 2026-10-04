"use client";

import { useActionState } from "react";
import { updateExpenseAction, type ActionState } from "@/features/expenses/actions";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@/features/payments/schema";
import { Input, Select } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { CurrencyExchangeFields } from "@/components/ui/currency-exchange-fields";
import { Button } from "@/components/ui/button";
import { ExpenseFiscalFields } from "@/components/fiscal/expense-fiscal-fields";

const initialState: ActionState = { error: null };

type Option = { id: string; name: string };
type ProjectOption = { id: string; number: string; name: string };
type ServiceTypeOption = { id: string; name: string; category_id: string; fiscal_classification_id: string | null };

export function ExpenseEditForm({
  expense,
  categories,
  suppliers,
  projects,
  bankCatalog,
  baseCurrency,
  serviceTypes = [],
  canSeeRules = false,
}: {
  expense: {
    id: string;
    category_id: string | null;
    supplier_id: string | null;
    project_id: string | null;
    expense_date: string;
    description: string;
    subtotal: number;
    tax: number;
    payment_method: string | null;
    currency: string;
    exchange_rate: number;
    payee_bank_name: string | null;
    service_type_id?: string | null;
    document_type?: string | null;
    ncf?: string | null;
  };
  categories: Option[];
  suppliers: (Option & { service_type_id?: string | null })[];
  projects: ProjectOption[];
  bankCatalog: Option[];
  baseCurrency: string;
  serviceTypes?: ServiceTypeOption[];
  canSeeRules?: boolean;
}) {
  const updateWithId = updateExpenseAction.bind(null, expense.id);
  const [state, formAction, pending] = useActionState(updateWithId, initialState);
  const impliedPercent =
    expense.subtotal > 0 ? Math.round((expense.tax / expense.subtotal) * 10000) / 100 : 0;

  return (
    <form action={formAction} className="max-w-md space-y-4">
      <Input label="Descripción" name="description" required defaultValue={expense.description} />
      <Input label="Fecha" name="expense_date" type="date" required defaultValue={expense.expense_date} />

      <Select label="Categoría" name="category_id" defaultValue={expense.category_id ?? ""}>
        <option value="">Sin categoría</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>

      <Select label="Proveedor" name="supplier_id" defaultValue={expense.supplier_id ?? ""}>
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
        defaultValue={expense.payee_bank_name ?? ""}
        hint="A qué banco se le deposita a él. No es la cuenta desde la que tú pagas."
      >
        <option value="">Sin especificar</option>
        {expense.payee_bank_name && !bankCatalog.some((b) => b.name === expense.payee_bank_name) && (
          <option value={expense.payee_bank_name}>{expense.payee_bank_name} (no está en el catálogo)</option>
        )}
        {bankCatalog.map((b) => (
          <option key={b.id} value={b.name}>
            {b.name}
          </option>
        ))}
      </Select>

      <Select label="Proyecto/Evento" name="project_id" defaultValue={expense.project_id ?? ""}>
        <option value="">Sin proyecto (gasto general de la empresa)</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.number} — {p.name}
          </option>
        ))}
      </Select>

      <div className="grid grid-cols-2 gap-3">
        <MoneyInput label="Subtotal" name="subtotal" min={0} required defaultValue={expense.subtotal} />
        <Input label="Impuesto (%)" name="tax_percent" type="number" step="0.01" min="0" defaultValue={impliedPercent} />
      </div>

      <ExpenseFiscalFields
        serviceTypes={serviceTypes}
        categories={categories}
        suppliers={suppliers}
        defaults={{
          supplierId: expense.supplier_id,
          serviceTypeId: expense.service_type_id,
          documentType: expense.document_type,
          ncf: expense.ncf,
        }}
        canSeeRules={canSeeRules}
      />

      <Select label="Método de pago" name="payment_method" defaultValue={expense.payment_method ?? ""}>
        <option value="">Sin especificar</option>
        {PAYMENT_METHODS.map((m) => (
          <option key={m} value={m}>
            {PAYMENT_METHOD_LABELS[m]}
          </option>
        ))}
      </Select>

      <CurrencyExchangeFields
        baseCurrency={baseCurrency}
        defaultCurrency={expense.currency}
        defaultExchangeRate={expense.exchange_rate}
      />

      {state.error && <p className="text-sm text-brand-danger">{state.error}</p>}

      <Button type="submit" loading={pending}>
        Guardar cambios
      </Button>
    </form>
  );
}
