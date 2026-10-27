"use client";

import { useState } from "react";
import Link from "next/link";
import { HandCoins } from "lucide-react";
import { useOverdraftConfirmAction } from "@/components/ui/overdraft-confirm";
import { applyAdvancesAction, type AdvanceActionState } from "@/features/advances/actions";
import { suggestApplications } from "@/features/advances/schema";
import { MoneyInput } from "@/components/ui/money-input";
import { Button } from "@/components/ui/button";
import { InfoHint } from "@/components/ui/info-hint";
import { formatMoney } from "@/lib/utils/money";
import { formatDate } from "@/lib/utils/dates";

const initialState: AdvanceActionState = { error: null };

export type ApplicableAdvance = { id: string; number: string; receipt_date: string; available: number; target: string };

/**
 * Recuadro «Aplicar anticipos» en la factura: los anticipos del mismo
 * proyecto/cotización (o del cliente) que todavía no se han usado. Al
 * aplicar, baja el balance de la factura; el banco no se mueve.
 */
export function ApplyAdvancesForm({
  invoiceId,
  balance,
  currency,
  advances,
  scopeLabel,
}: {
  invoiceId: string;
  balance: number;
  currency: string;
  advances: ApplicableAdvance[];
  /** «Este proyecto», «Esta cotización» o «Este cliente». */
  scopeLabel: string;
}) {
  const [state, formAction, pending, dialogs, formKey] = useOverdraftConfirmAction(
    applyAdvancesAction.bind(null, invoiceId),
    initialState,
  );
  const suggested = suggestApplications(advances.map((a) => ({ id: a.id, available: a.available })), balance);
  const [checked, setChecked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(suggested.map((s) => [s.id, s.amount > 0])),
  );
  const [amounts, setAmounts] = useState<Record<string, number>>(() =>
    Object.fromEntries(suggested.map((s) => [s.id, s.amount])),
  );
  const totalAvailable = advances.reduce((acc, a) => acc + a.available, 0);
  const rows = advances.map((a) => ({ ...a, on: Boolean(checked[a.id]), amount: amounts[a.id] ?? 0 }));
  const total = Math.round(rows.filter((r) => r.on).reduce((acc, r) => acc + (r.amount > 0 ? r.amount : 0), 0) * 100) / 100;
  const over = rows.some((r) => r.on && r.amount > r.available + 0.005);
  const exceeds = total > balance + 0.005;
  const after = Math.max(0, Math.round((balance - total) * 100) / 100);
  const payload = rows.filter((r) => r.on && r.amount > 0).map((r) => ({ advance_id: r.id, amount: r.amount }));

  return (
    <section
      id="aplicar-anticipos"
      className="scroll-mt-20 rounded-[var(--radius-lg)] border border-brand-accent/30 bg-brand-accent-light p-4"
    >
      <div className="mb-3 flex items-start gap-3">
        <span className="mt-0.5 rounded-full bg-brand-surface p-2 text-brand-accent">
          <HandCoins size={18} aria-hidden />
        </span>
        <div>
          <p className="flex items-center gap-1 text-sm font-semibold text-brand-text">
            {scopeLabel} tiene {formatMoney(totalAvailable, currency)} en anticipos sin aplicar
            <InfoHint text="Dinero que el cliente entregó antes de esta factura. Al aplicarlo, se descuenta de lo que debe. No se mueve el banco: ese dinero ya entró el día del anticipo. Así no se cobra dos veces." />
          </p>
          <p className="text-xs text-brand-muted">
            Marca los que quieras descontar de esta factura. Ya vienen sugeridos hasta cubrir el balance.
          </p>
        </div>
      </div>

      <form key={formKey} action={formAction} className="space-y-3">
        <input type="hidden" name="applications" value={JSON.stringify(payload)} />
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <li
              key={r.id}
              className="grid grid-cols-1 items-center gap-2 rounded-[var(--radius-md)] border border-brand-border bg-brand-surface px-3 py-2 sm:grid-cols-[auto_1fr_12rem]"
            >
              <input
                type="checkbox"
                aria-label={`Aplicar ${r.number}`}
                checked={r.on}
                onChange={(e) => setChecked((c) => ({ ...c, [r.id]: e.target.checked }))}
              />
              <span className="text-sm">
                <Link href={`/advances/${r.id}`} className="font-semibold text-brand-accent hover:underline">
                  {r.number}
                </Link>{" "}
                <span className="text-brand-muted">
                  · {formatDate(r.receipt_date)} · {r.target} · disponible {formatMoney(r.available, currency)}
                </span>
              </span>
              <MoneyInput
                name={`amount_${r.id}`}
                defaultValue={r.amount}
                disabled={!r.on}
                error={r.on && r.amount > r.available + 0.005 ? "Más de lo disponible" : undefined}
                onValueChange={(v) => setAmounts((m) => ({ ...m, [r.id]: v }))}
              />
            </li>
          ))}
        </ul>

        <div
          className={`flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] px-3 py-2 text-sm ${
            exceeds || over ? "bg-brand-danger-bg text-brand-danger" : "bg-brand-surface text-brand-text"
          }`}
          role="status"
        >
          <span>
            Balance {formatMoney(balance, currency)} − anticipos <strong>{formatMoney(total, currency)}</strong> = queda
            debiendo <strong>{formatMoney(after, currency)}</strong>
            {after <= 0.005 && total > 0 ? " (la factura queda pagada)" : ""}
          </span>
          {exceeds && <span className="text-xs font-medium">Es más de lo que debe la factura. Baja algún monto.</span>}
        </div>

        <div className="flex justify-end">
          <Button type="submit" loading={pending} disabled={payload.length === 0 || exceeds || over}>
            Aplicar anticipos
          </Button>
        </div>
        {dialogs}
      </form>
    </section>
  );
}
