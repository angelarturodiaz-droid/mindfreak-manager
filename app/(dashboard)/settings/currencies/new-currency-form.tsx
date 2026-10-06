"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { createCurrencyAction, type CurrencyActionState } from "@/features/currencies/actions";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useSuccessToast } from "@/components/ui/use-success-toast";

const initialState: CurrencyActionState = { error: null };

export function NewCurrencyForm() {
  const [state, formAction, pending] = useActionState(createCurrencyAction, initialState);
  useSuccessToast(state);

  return (
    <form key={state.successId} action={formAction} className="flex flex-wrap items-end gap-2">
      <Input label="Código" name="code" required maxLength={3} placeholder="EUR" className="w-24 uppercase" hint="3 letras (ISO)" />
      <Input label="Nombre" name="name" required placeholder="Euro" className="w-48" />
      <Input label="Símbolo" name="symbol" placeholder="€" className="w-20" />
      <Input label="Decimales" name="decimals" type="number" min="0" max="4" defaultValue="2" className="w-24" />
      <Button type="submit" loading={pending} icon={<Plus size={14} />}>
        Agregar moneda
      </Button>
      {state.error && <p className="w-full text-sm text-brand-danger">{state.error}</p>}
    </form>
  );
}
