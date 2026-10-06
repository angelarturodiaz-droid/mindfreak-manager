"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { saveExchangeRateAction, type CurrencyActionState } from "@/features/currencies/actions";
import { RATE_SOURCES, RATE_SOURCE_LABELS, describeRate, type RateSource } from "@/features/currencies/schema";
import { Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useSuccessToast } from "@/components/ui/use-success-toast";
import { FIELD_HINTS } from "@/lib/ui/field-hints";

const initialState: CurrencyActionState = { error: null };

export function ExchangeRateForm({
  currencies,
  functional,
  defaultSource,
  defaultSourceName,
  today,
}: {
  currencies: string[];
  functional: string;
  defaultSource: RateSource;
  defaultSourceName: string | null;
  today: string;
}) {
  const [state, formAction, pending] = useActionState(saveExchangeRateAction, initialState);
  const [code, setCode] = useState(currencies[0] ?? "");
  const [rate, setRate] = useState("");
  useSuccessToast(state);

  if (currencies.length === 0) {
    return <p className="text-sm text-brand-muted">Activa otra moneda además de {functional} para registrar tasas.</p>;
  }
  const n = Number(rate);

  return (
    <form key={state.successId} action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <Select label="Moneda" name="currency_code" value={code} onChange={(e) => setCode(e.target.value)} className="w-28">
          {currencies.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <Input label="Fecha" name="effective_date" type="date" required defaultValue={today} className="w-40" />
        <Input
          label={`Tasa (${functional} por 1 ${code})`}
          name="rate_to_base"
          type="number"
          step="0.000001"
          min="0.000001"
          required
          placeholder="58.80"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          info={FIELD_HINTS.referenceRate}
          className="w-44"
        />
        <Select label="Fuente" name="source" defaultValue={defaultSource} className="w-48">
          {RATE_SOURCES.map((s) => (
            <option key={s} value={s}>
              {RATE_SOURCE_LABELS[s]}
            </option>
          ))}
        </Select>
        <Input label="Detalle de la fuente" name="source_name" defaultValue={defaultSourceName ?? ""} placeholder="Opcional" className="w-44" />
        <Button type="submit" loading={pending} icon={<Plus size={14} />}>
          Guardar tasa
        </Button>
      </div>
      <p className="text-xs text-brand-muted">
        {n > 0 ? describeRate(code, n, functional) : `Escribe cuántos ${functional} vale 1 ${code}.`} Si ya hay una tasa de {code} para esa fecha, se reemplaza.
      </p>
      {state.error && <p className="text-sm text-brand-danger">{state.error}</p>}
    </form>
  );
}
