"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FolderKanban, FileText, UserRound, Info, CheckCircle2 } from "lucide-react";
import { useOverdraftConfirmAction } from "@/components/ui/overdraft-confirm";
import { registerAdvanceAction, type AdvanceActionState } from "@/features/advances/actions";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@/features/payments/schema";
import { Input, Select, Textarea } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { Button } from "@/components/ui/button";
import { SearchSelect } from "@/components/ui/search-select";
import { InfoHint } from "@/components/ui/info-hint";
import { AccountPicker } from "@/components/payments/account-picker";
import { AccountIncomingHint } from "@/components/banks/account-funds-hint";
import { FormSection, FormFooter } from "@/components/payments/form-section";
import { ForeignPaymentBlock, type RateHistory } from "@/components/payments/foreign-payment-block";
import type { AccountFunds } from "@/features/banks/queries";
import type { AdvanceTargetOption } from "@/features/advances/queries";
import { canBeBeforeCutoff, CUTOFF_LABEL } from "@/features/advances/schema";
import { todayISO } from "@/lib/utils/dates";
import { formatMoney } from "@/lib/utils/money";

const initialState: AdvanceActionState = { error: null };

type BankAccount = { id: string; name: string; bank_name: string | null; currency: string; type?: string | null };

const KIND_ICON = {
  project: <FolderKanban size={16} aria-hidden />,
  quotation: <FileText size={16} aria-hidden />,
  client: <UserRound size={16} aria-hidden />,
};

/**
 * «Registrar anticipo» (V1-3), paso a paso:
 * 1. De quién y para qué (proyecto, cotización aprobada o solo el cliente).
 * 2. Cuánto y cuándo (con lo sugerido y lo que resta).
 * 3. Dónde entró el dinero (o «Recibido antes del corte»).
 * Al guardar abre el anticipo, con su recibo ANT listo para descargar.
 */
export function NewAdvanceForm({
  clients,
  targets,
  initialClientId,
  initialTarget,
  currencies,
  bankAccounts,
  funds,
  fxContext,
  backHref,
  backLabel,
}: {
  clients: { id: string; name: string }[];
  targets: AdvanceTargetOption[];
  initialClientId: string;
  initialTarget: string;
  currencies: { code: string; name: string }[];
  bankAccounts: BankAccount[];
  funds: Record<string, AccountFunds>;
  fxContext: { functionalCurrency: string; tolerance: number; rates: RateHistory };
  backHref: string;
  backLabel: string;
}) {
  const [state, formAction, pending, dialogs] = useOverdraftConfirmAction(registerAdvanceAction, initialState);
  const [clientId, setClientId] = useState(initialClientId);
  const [target, setTarget] = useState(initialTarget);
  const [freeCurrency, setFreeCurrency] = useState(fxContext.functionalCurrency);
  const [amount, setAmount] = useState(0);
  const [amountKey, setAmountKey] = useState(0);
  const [receiptDate, setReceiptDate] = useState(todayISO());
  const [beforeCutoff, setBeforeCutoff] = useState(false);
  const [accountId, setAccountId] = useState("");
  const [bankIn, setBankIn] = useState<{ amount: number; fee: number }>({ amount: 0, fee: 0 });

  const clientTargets = useMemo(() => targets.filter((t) => t.clientId === clientId), [targets, clientId]);
  const options: AdvanceTargetOption[] = clientId
    ? [
        ...clientTargets,
        {
          value: "client",
          clientId,
          kind: "client",
          label: "Sin cotización ni proyecto",
          detail: "Solo el cliente: se aplica a cualquier factura suya en la misma moneda",
          currency: null,
          totalQuoted: null,
          received: 0,
          advancePercent: null,
        },
      ]
    : [];
  const chosen = options.find((o) => o.value === target) ?? null;
  const currency = chosen?.currency ?? freeCurrency;
  const account = bankAccounts.find((b) => b.id === accountId);
  const foreign = Boolean(account && account.currency !== currency);
  const cutoffAllowed = canBeBeforeCutoff(receiptDate);
  const isBeforeCutoff = beforeCutoff && cutoffAllowed;

  const suggested =
    chosen?.totalQuoted && chosen.advancePercent && chosen.advancePercent < 100
      ? Math.round(chosen.totalQuoted * chosen.advancePercent) / 100
      : null;
  const remainingBefore = chosen?.totalQuoted ? Math.max(0, chosen.totalQuoted - chosen.received) : null;
  const remainingAfter = remainingBefore !== null ? Math.max(0, remainingBefore - (amount > 0 ? amount : 0)) : null;
  const exceeds = remainingBefore !== null && amount > remainingBefore + 0.005;

  function pickClient(id: string) {
    setClientId(id);
    setTarget("");
  }
  function applySuggested(v: number) {
    setAmount(v);
    setAmountKey((k) => k + 1);
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="client_id" value={clientId} />
      <input type="hidden" name="target" value={target} />
      <input type="hidden" name="currency" value={currency} />
      <input type="hidden" name="before_cutoff" value={isBeforeCutoff ? "1" : "0"} />

      <FormSection step={1} title="¿De quién es y para qué?" cols={2}>
        <div className="sm:col-span-2 sm:max-w-md">
          <SearchSelect
            label="Cliente"
            name="client_pick"
            options={clients.map((c) => ({ value: c.id, label: c.name }))}
            value={clientId}
            onChange={(v) => pickClient(v)}
            emptyLabel={null}
            placeholder="Escribe el nombre del cliente…"
            info="El cliente que entregó el dinero. Solo se ven sus proyectos y cotizaciones aprobadas."
            required
          />
        </div>
        {clientId && (
          <div className="sm:col-span-2">
            <p className="mb-2 flex items-center gap-1 text-sm font-medium text-brand-text">
              ¿Para qué es el anticipo?
              <InfoHint text="Elige el evento. Así, cuando emitas su factura final, el sistema te ofrece descontar el anticipo. Si todavía no hay cotización aprobada, elige «Sin cotización ni proyecto»: luego lo puedes pasar al proyecto." />
            </p>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {options.map((o) => {
                const active = o.value === target;
                return (
                  <label
                    key={o.value}
                    className={`flex cursor-pointer items-start gap-3 rounded-[var(--radius-md)] border px-3 py-2.5 text-sm transition-colors ${
                      active ? "border-brand-accent bg-brand-accent-light" : "border-brand-border hover:bg-brand-surface-hover"
                    }`}
                  >
                    <input
                      type="radio"
                      name="target_pick"
                      className="mt-1"
                      checked={active}
                      onChange={() => setTarget(o.value)}
                    />
                    <span className="mt-0.5 text-brand-accent">{KIND_ICON[o.kind]}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-brand-text">{o.label}</span>
                      <span className="block text-xs text-brand-muted">{o.detail}</span>
                      {o.totalQuoted !== null && o.currency && (
                        <span className="mt-0.5 block text-xs text-brand-muted">
                          Cotizado {formatMoney(o.totalQuoted, o.currency)}
                          {o.received > 0 ? ` · ya pagado (anticipos y cobros) ${formatMoney(o.received, o.currency)}` : ""}
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
            {clientTargets.length === 0 && (
              <p className="mt-2 text-xs text-brand-muted">
                Este cliente no tiene proyectos ni cotizaciones aprobadas. Puedes registrar el anticipo «sin cotización ni
                proyecto» y pasarlo después al proyecto.
              </p>
            )}
          </div>
        )}
      </FormSection>

      {chosen && (
        <>
          <FormSection step={2} title="¿Cuánto y cuándo?">
            <Input
              label="Fecha en que se recibió"
              name="receipt_date"
              type="date"
              required
              value={receiptDate}
              onChange={(e) => setReceiptDate(e.target.value)}
            />
            <div className="flex flex-col gap-1">
              <MoneyInput
                key={`amount-${amountKey}`}
                label={`Monto del anticipo (${currency})`}
                name="amount"
                required
                defaultValue={amount || ""}
                error={exceeds ? "Es más de lo que resta por pagar de lo cotizado. Revisa el monto." : undefined}
                hint={
                  remainingBefore !== null
                    ? `Resta por pagar de lo cotizado: ${formatMoney(remainingBefore, currency)}`
                    : "Lo que entregó el cliente, sin impuestos (el anticipo no lleva ITBIS)."
                }
                onValueChange={setAmount}
              />
              {suggested !== null && suggested > 0 && (
                <button
                  type="button"
                  onClick={() => applySuggested(suggested)}
                  className="w-fit text-xs text-brand-accent hover:underline"
                  title="La cotización dice qué porcentaje se paga por adelantado."
                >
                  Usar el {chosen.advancePercent}% pactado en la cotización: {formatMoney(suggested, currency)}
                </button>
              )}
            </div>
            <Select label="Método" name="method" defaultValue="TRANSFER">
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_METHOD_LABELS[m]}
                </option>
              ))}
            </Select>
            {!chosen.currency && (
              <Select
                label="Moneda"
                name="currency_pick"
                value={freeCurrency}
                onChange={(e) => setFreeCurrency(e.target.value)}
                hint="Este destino no tiene cotización: elige la moneda en que pagó el cliente."
              >
                {currencies.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </Select>
            )}
            {chosen.currency && chosen.currency !== fxContext.functionalCurrency && (
              <p className="text-xs text-brand-muted sm:col-span-2">
                La cotización está en {chosen.currency}: el anticipo se anota en {chosen.currency}. Si el dinero entró a una
                cuenta en otra moneda, abajo te pedimos cuánto entró realmente.
              </p>
            )}
          </FormSection>

          {cutoffAllowed && (
            <div className="rounded-[var(--radius-md)] border border-brand-border bg-brand-surface-hover px-3 py-2.5 text-sm">
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={beforeCutoff}
                  onChange={(e) => setBeforeCutoff(e.target.checked)}
                />
                <span>
                  <span className="flex items-center gap-1 font-medium text-brand-text">
                    Recibido antes del corte (antes del {CUTOFF_LABEL})
                    <InfoHint text="Solo para eventos que ya estaban en curso cuando empezamos a usar el sistema. Ese dinero ya está en el saldo inicial del banco, así que NO se suma otra vez al banco; pero sí se descuenta de la factura final." />
                  </span>
                  <span className="block text-xs text-brand-muted">
                    Márcalo solo si el dinero entró antes de empezar a usar el sistema. No se elige cuenta.
                  </span>
                </span>
              </label>
            </div>
          )}

          {!isBeforeCutoff && (
            <FormSection step={3} title="Cuenta donde entró el dinero" cols={2}>
              <AccountPicker
                accounts={bankAccounts}
                kind="bank"
                direction="in"
                documentCurrency={currency}
                value={accountId}
                onChange={(id) => {
                  setAccountId(id);
                  setBankIn({ amount: 0, fee: 0 });
                }}
                label="Cuenta bancaria"
              />
              <Input label="Referencia" name="reference" placeholder="Opcional (ej. número de transferencia)" />
              {accountId && (
                <div className="sm:col-span-2">
                  <AccountIncomingHint
                    funds={funds[accountId]}
                    amount={amount}
                    amountCurrency={currency}
                    bank={foreign ? bankIn : undefined}
                    what="anticipo"
                  />
                </div>
              )}
              {account && foreign && (
                <div className="sm:col-span-2">
                  <ForeignPaymentBlock
                    key={`${account.id}-${currency}`}
                    kind="COBRO"
                    documentLabel="anticipo"
                    documentCurrency={currency}
                    accountCurrency={account.currency}
                    accountName={account.name}
                    functionalCurrency={fxContext.functionalCurrency}
                    applied={amount}
                    date={receiptDate}
                    rates={fxContext.rates}
                    tolerance={fxContext.tolerance}
                    markMissing={state.field === "fx"}
                    missingKey={state}
                    onBankChange={setBankIn}
                  />
                </div>
              )}
            </FormSection>
          )}
          {isBeforeCutoff && <input type="hidden" name="reference" value="" />}

          <FormSection step={isBeforeCutoff ? 3 : 4} title="Nota (opcional)" cols={2}>
            <div className="sm:col-span-2">
              <Textarea name="notes" rows={2} placeholder="Ej. 50 % para separar la fecha del evento" />
            </div>
          </FormSection>

          <div className="rounded-[var(--radius-md)] border border-brand-accent/25 bg-brand-accent-light px-4 py-3 text-sm" role="status">
            <p className="mb-1 flex items-center gap-1.5 font-semibold text-brand-text">
              <Info size={15} aria-hidden className="text-brand-accent" />
              Qué va a pasar al registrar
            </p>
            <ul className="space-y-0.5 text-brand-text">
              <li className="flex gap-1.5">
                <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-brand-success" aria-hidden />
                {isBeforeCutoff
                  ? "No se mueve el banco: ese dinero ya está en el saldo inicial."
                  : `Entran ${amount > 0 ? formatMoney(amount, currency) : "el monto"} a ${account?.name ?? "la cuenta que elijas"} con la categoría «Anticipo de cliente».`}
              </li>
              <li className="flex gap-1.5">
                <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-brand-success" aria-hidden />
                Se crea el recibo de anticipo (ANT-…) para enviárselo al cliente. No es factura ni lleva impuestos.
              </li>
              <li className="flex gap-1.5">
                <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-brand-success" aria-hidden />
                Todavía no cuenta como venta: la ganancia del proyecto no cambia hasta que emitas la factura final.
              </li>
              <li className="flex gap-1.5">
                <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-brand-success" aria-hidden />
                Cuando emitas la factura final, ábrela y pulsa «Aplicar anticipos»: se descuenta de lo que el cliente debe.
              </li>
              {remainingAfter !== null && amount > 0 && !exceeds && (
                <li className="flex gap-1.5">
                  <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-brand-success" aria-hidden />
                  Después de este anticipo resta por pagar {formatMoney(remainingAfter, currency)} de lo cotizado.
                </li>
              )}
            </ul>
          </div>
        </>
      )}

      <FormFooter error={state.error}>
        <Link
          href={backHref}
          className="inline-flex items-center rounded-[var(--radius-md)] px-3 py-2 text-sm text-brand-muted hover:bg-brand-surface-hover hover:text-brand-text"
        >
          Cancelar y volver a {backLabel}
        </Link>
        <Button type="submit" loading={pending} disabled={!chosen || amount <= 0 || exceeds}>
          Registrar anticipo
        </Button>
      </FormFooter>
      {dialogs}
    </form>
  );
}
