"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Landmark, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InfoHint } from "@/components/ui/info-hint";
import { toast } from "@/components/ui/toaster";
import {
  suggestedAccountIds,
  type BankDetail,
  type BankDetailOption,
} from "@/features/banks/bank-details";

/**
 * "Datos bancarios para el pago" en el detalle de una factura o cotización:
 * qué cuentas salen en el recuadro DATOS BANCARIOS del PDF. Solo se ofrecen
 * las cuentas marcadas en Bancos como "Mostrar en facturas y cotizaciones"
 * (nunca tarjetas). Se guarda una copia de los datos en el documento.
 */
export function BankDetailsPicker({
  docLabel,
  currency,
  options,
  current,
  editable,
  lockedReason,
  onSave,
}: {
  /** "factura" o "cotización" (para los textos). */
  docLabel: string;
  currency: string;
  options: BankDetailOption[];
  current: BankDetail[];
  editable: boolean;
  /** Por qué no se puede cambiar (si editable = false). */
  lockedReason?: string;
  onSave: (ids: string[]) => Promise<{ error: string | null }>;
}) {
  const optionIds = new Set(options.map((o) => o.id));
  const savedIds = current.map((d) => d.bank_account_id);
  const [selected, setSelected] = useState<string[]>(savedIds.filter((id) => optionIds.has(id)));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const suggested = suggestedAccountIds(options, currency);
  const dropped = current.filter((d) => !optionIds.has(d.bank_account_id));
  const changed =
    selected.length !== savedIds.length || selected.some((id) => !savedIds.includes(id)) || dropped.length > 0;
  const isSuggested =
    selected.length === suggested.length && suggested.every((id) => selected.includes(id));

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function save(ids: string[]) {
    setError(null);
    startTransition(async () => {
      const res = await onSave(ids);
      if (res.error) {
        setError(res.error);
      } else {
        toast.success(ids.length ? "Datos bancarios guardados." : "Se quitaron los datos bancarios del PDF.");
      }
    });
  }

  // Solo lectura: lo que sale en el PDF.
  if (!editable) {
    return (
      <div className="flex flex-col gap-2 text-sm">
        {current.length === 0 ? (
          <p className="text-brand-muted">Sin datos bancarios en el PDF.</p>
        ) : (
          current.map((d) => <SavedLine key={d.bank_account_id} d={d} />)
        )}
        {lockedReason && <p className="text-xs text-brand-muted">{lockedReason}</p>}
      </div>
    );
  }

  if (options.length === 0) {
    return (
      <div className="flex flex-col gap-2 text-sm">
        {current.map((d) => (
          <SavedLine key={d.bank_account_id} d={d} />
        ))}
        <p className="text-brand-muted">
          Todavía no hay cuentas para mostrar. Ve a{" "}
          <Link href="/banks" className="text-brand-accent hover:underline">
            Bancos
          </Link>
          , abre la cuenta → <span className="font-medium">Editar cuenta</span> y marca{" "}
          <span className="font-medium">Mostrar en facturas y cotizaciones</span>.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 text-sm">
      <ul className="flex flex-col gap-2">
        {options.map((o) => {
          const checked = selected.includes(o.id);
          const sameCurrency = o.currency === currency;
          return (
            <li key={o.id}>
              <label
                className={`flex cursor-pointer items-start gap-2 rounded-[var(--radius-md)] border p-2 transition-colors ${
                  checked ? "border-brand-accent bg-brand-accent/5" : "border-brand-border hover:bg-brand-surface-hover"
                }`}
              >
                <input type="checkbox" className="mt-0.5" checked={checked} onChange={() => toggle(o.id)} />
                <span className="flex min-w-0 flex-col">
                  <span className="font-medium text-brand-text">
                    {o.name}{" "}
                    <span className="text-xs font-normal text-brand-muted">· {o.currency}</span>
                  </span>
                  <span className="text-xs text-brand-muted">
                    {o.bank_name ?? "Banco sin indicar"}
                    {o.account_number_masked ? ` · ${o.account_number_masked}` : " · sin número"}
                  </span>
                  {checked && !sameCurrency && (
                    <span className="text-xs text-brand-warning">
                      Esta cuenta es en {o.currency} y la {docLabel} es en {currency}.
                    </span>
                  )}
                  {!o.account_number_masked && checked && (
                    <span className="text-xs text-brand-warning">Falta el número de cuenta (se completa en Bancos).</span>
                  )}
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      {dropped.length > 0 && (
        <p className="text-xs text-brand-warning">
          {dropped.map((d) => d.account_name).join(", ")}: ya no está marcada para facturas en Bancos. Al guardar se
          quita del PDF.
        </p>
      )}
      {error && <p className="text-sm text-brand-danger">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          loading={pending}
          disabled={!changed}
          onClick={() => save(selected)}
          hint="Guarda qué cuentas salen en el recuadro DATOS BANCARIOS del PDF."
        >
          Guardar cuentas
        </Button>
        {!isSuggested && suggested.length > 0 && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            icon={<Sparkles size={13} />}
            onClick={() => setSelected(suggested)}
            hint={`Marca solo las cuentas en ${currency}, la moneda de la ${docLabel}.`}
          >
            Usar la sugerida
          </Button>
        )}
        {!changed && current.length > 0 && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            loading={pending}
            onClick={() => save(selected)}
            hint="Vuelve a copiar los datos de Bancos (por si cambiaste el número, el tipo o el titular)."
          >
            Actualizar datos
          </Button>
        )}
      </div>
    </div>
  );
}

function SavedLine({ d }: { d: BankDetail }) {
  return (
    <div className="flex items-start gap-2">
      <Landmark size={14} className="mt-0.5 shrink-0 text-brand-muted" />
      <div className="min-w-0">
        <p className="font-medium text-brand-text">
          {d.bank_name ?? d.account_name} <span className="text-xs font-normal text-brand-muted">· {d.currency}</span>
        </p>
        <p className="text-xs text-brand-muted">
          {d.number ?? "sin número"}
          {d.kind_label ? ` (${d.kind_label})` : ""}
          {d.holder ? ` · ${d.holder}` : ""}
        </p>
      </div>
    </div>
  );
}

/** Título de la tarjeta con su explicación. */
export function BankDetailsTitle({ docLabel }: { docLabel: string }) {
  return (
    <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-brand-text">
      Datos bancarios para el pago
      <InfoHint
        text={`Las cuentas que marques salen abajo en el PDF de la ${docLabel} para que el cliente sepa dónde pagar. Se ofrecen las cuentas marcadas en Bancos como "Mostrar en facturas y cotizaciones"; nunca tarjetas.`}
      />
    </p>
  );
}
