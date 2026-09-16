"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { createPaymentTermAction, type ActionState } from "@/features/payment-terms/actions";
import { PAYMENT_TERM_METHODS, PAYMENT_METHOD_LABELS } from "@/features/payment-terms/schema";
import { Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

const initialState: ActionState = { error: null };

export function NewPaymentTermForm() {
  const [state, formAction, pending] = useActionState(createPaymentTermAction, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <Input label="Nombre" name="name" required placeholder="Ej. Crédito 90 días" className="w-48" />
      <Input label="Días de crédito" name="credit_days" type="number" min={0} defaultValue={0} className="w-32" />
      <Select label="Forma de pago" name="payment_method" defaultValue="TRANSFER" className="w-40">
        {PAYMENT_TERM_METHODS.map((m) => (
          <option key={m} value={m}>
            {PAYMENT_METHOD_LABELS[m]}
          </option>
        ))}
      </Select>
      <Input label="% Anticipo" name="advance_percent" type="number" min={0} max={100} defaultValue={100} className="w-28" />
      <Input label="% Saldo" name="balance_percent" type="number" min={0} max={100} defaultValue={0} className="w-28" />
      <Button type="submit" loading={pending} icon={<Plus size={14} />}>
        Agregar
      </Button>
      {state.error && <p className="w-full text-sm text-brand-danger">{state.error}</p>}
    </form>
  );
}
