"use client";

import { useActionState, useState } from "react";
import { updateCurrencySettingsAction, type CurrencyActionState } from "@/features/currencies/actions";
import { RATE_SOURCES, RATE_SOURCE_LABELS, type RateSource } from "@/features/currencies/schema";
import { Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useSuccessToast } from "@/components/ui/use-success-toast";
import { FIELD_HINTS } from "@/lib/ui/field-hints";

const initialState: CurrencyActionState = { error: null };

export function CurrencySettingsForm({
  functional,
  settings,
  canManage,
}: {
  functional: string;
  settings: { reference_rate_source: RateSource; reference_source_name: string | null; rounding_tolerance: number };
  canManage: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateCurrencySettingsAction, initialState);
  const [source, setSource] = useState<RateSource>(settings.reference_rate_source);
  useSuccessToast(state);

  return (
    <form action={formAction} className="grid max-w-2xl gap-4 sm:grid-cols-2">
      <Input label="Moneda funcional" value={functional} readOnly disabled info={FIELD_HINTS.functionalCurrency} hint="Se cambia en Organización (solo mientras no haya documentos)." />
      <Input
        label={`Tolerancia de redondeo (${functional})`}
        name="rounding_tolerance"
        type="number"
        step="0.01"
        min="0"
        max="1000"
        defaultValue={settings.rounding_tolerance.toFixed(2)}
        info={FIELD_HINTS.roundingTolerance}
        disabled={!canManage}
      />
      <Select
        label="Fuente de la tasa de referencia"
        name="reference_rate_source"
        value={source}
        onChange={(e) => setSource(e.target.value as RateSource)}
        info={FIELD_HINTS.rateSource}
        disabled={!canManage}
      >
        {RATE_SOURCES.map((s) => (
          <option key={s} value={s}>
            {RATE_SOURCE_LABELS[s]}
          </option>
        ))}
      </Select>
      <Input
        label={source === "OTHER" ? "Nombre de la fuente" : source === "BANK" ? "Banco (opcional)" : "Detalle (opcional)"}
        name="reference_source_name"
        defaultValue={settings.reference_source_name ?? ""}
        placeholder={source === "BANK" ? "Ej. Banco Popular" : source === "OTHER" ? "Ej. Infodolar" : ""}
        disabled={!canManage}
        error={state.field === "reference_source_name" && source === "OTHER" ? state.error ?? undefined : undefined}
        hint={source === "OTHER" ? "Requerido con «Otra fuente»." : undefined}
      />
      {state.error && state.field !== "reference_source_name" && (
        <p className="text-sm text-brand-danger sm:col-span-2">{state.error}</p>
      )}
      {canManage && (
        <div className="sm:col-span-2">
          <Button
            type="submit"
            loading={pending}
            hint="Guarda la moneda funcional y la tolerancia de redondeo. La moneda funcional se bloquea cuando ya hay movimientos."
          >
            Guardar configuración
          </Button>
        </div>
      )}
    </form>
  );
}
