"use client";

import { useActionState } from "react";
import { updateOrganizationAction, type ActionState } from "@/features/settings/actions";
import { Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { FIELD_HINTS } from "@/lib/ui/field-hints";

const initialState: ActionState = { error: null };

export function OrganizationForm({
  company,
  currencies,
  currencyLocked,
}: {
  currencies: { code: string; name: string }[];
  /** Ya hay documentos o movimientos: la moneda funcional no se puede cambiar. */
  currencyLocked: boolean;
  company: {
    legal_name: string | null;
    tax_id: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    base_currency: string;
  };
}) {
  const [state, formAction, pending] = useActionState(updateOrganizationAction, initialState);

  return (
    <form action={formAction} className="max-w-md space-y-4">
      <Input label="Nombre legal" name="legal_name" defaultValue={company.legal_name ?? ""} />
      <Input label="RNC" name="tax_id" defaultValue={company.tax_id ?? ""} />
      <Input label="Dirección" name="address" defaultValue={company.address ?? ""} />

      <div className="grid grid-cols-2 gap-3">
        <Input label="Teléfono" name="phone" defaultValue={company.phone ?? ""} />
        <Input label="Correo" name="email" type="email" defaultValue={company.email ?? ""} />
      </div>

      <Select
        label="Moneda base (funcional)"
        name="base_currency"
        defaultValue={company.base_currency}
        disabled={currencyLocked}
        info={FIELD_HINTS.functionalCurrency}
        hint={
          currencyLocked
            ? "Ya hay documentos o movimientos registrados: la moneda funcional no se puede cambiar."
            : "Usada para consolidar reportes, dashboard y rentabilidad. Las monedas se administran en Monedas y tasas."
        }
      >
        {(currencies.some((c) => c.code === company.base_currency)
          ? currencies
          : [{ code: company.base_currency, name: company.base_currency }, ...currencies]
        ).map((c) => (
          <option key={c.code} value={c.code}>
            {c.code} — {c.name}
          </option>
        ))}
      </Select>
      {currencyLocked && <input type="hidden" name="base_currency" value={company.base_currency} />}

      {state.error && <p className="text-sm text-brand-danger">{state.error}</p>}

      <Button type="submit" loading={pending}>
        Guardar cambios
      </Button>
    </form>
  );
}
