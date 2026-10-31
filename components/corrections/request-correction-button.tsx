"use client";

import { useState, useTransition } from "react";
import { Ban, Info, PencilLine, ShieldCheck } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { ResultDialog } from "@/components/ui/result-dialog";
import { requestCorrectionAction } from "@/features/corrections/actions";
import {
  CORRECTION_INFO,
  whatWillHappen,
  type CorrectionAction,
  type CorrectionTargetType,
} from "@/features/corrections/schema";
import { formatMoney } from "@/lib/utils/money";
import { formatDate, todayISO } from "@/lib/utils/dates";

export type CorrectionAccountOption = { id: string; name: string; currency: string; type?: string | null };

/**
 * «Corregir»: pide una corrección o anulación de un cobro, un pago a proveedor
 * o un movimiento manual de banco. Guiado en 3 pasos; no cambia nada hasta que
 * otra persona de Administración o Finanzas lo apruebe (V1-4).
 */
export function RequestCorrectionButton({
  targetType,
  targetId,
  label,
  current,
  accounts,
  allowMoneyChange = true,
  moneyChangeBlockedReason,
}: {
  targetType: CorrectionTargetType;
  targetId: string;
  /** Ej. «Cobro de RD$38,000 del 29 oct». */
  label: string;
  current: {
    amount: number;
    currency: string;
    date: string;
    accountId: string | null;
    accountName: string | null;
    accountCurrency: string | null;
    reference: string | null;
    description?: string | null;
  };
  accounts: CorrectionAccountOption[];
  /** false = solo fecha/referencia (ej. cobro con retenciones o en otra moneda). */
  allowMoneyChange?: boolean;
  moneyChangeBlockedReason?: string;
}) {
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<CorrectionAction | null>(null);
  const [amount, setAmount] = useState(current.amount);
  const [date, setDate] = useState(current.date);
  const [accountId, setAccountId] = useState(current.accountId ?? "");
  const [reference, setReference] = useState(current.reference ?? "");
  const [description, setDescription] = useState(current.description ?? "");
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const accCurrency = current.accountCurrency ?? current.currency;
  const accountOptions = accounts.filter(
    (a) => a.currency === accCurrency && (targetType !== "customer_payment" || a.type !== "CREDIT_CARD"),
  );

  const changed = {
    amount: allowMoneyChange && Math.abs(amount - current.amount) > 0.004,
    account: allowMoneyChange && Boolean(accountId) && accountId !== (current.accountId ?? ""),
    date: date !== current.date,
    reference: reference.trim() !== (current.reference ?? "").trim(),
    description: targetType === "bank_transaction" && description.trim() !== (current.description ?? "").trim() && description.trim() !== "",
  };
  const anyChange = Object.values(changed).some(Boolean);
  const reasonOk = reason.trim().length >= 10;
  const canSend = action !== null && reasonOk && (action === "VOID" || anyChange) && amount > 0;

  function reset() {
    setAction(null);
    setAmount(current.amount);
    setDate(current.date);
    setAccountId(current.accountId ?? "");
    setReference(current.reference ?? "");
    setDescription(current.description ?? "");
    setReason("");
  }

  function send() {
    if (!action) return;
    startTransition(async () => {
      const res = await requestCorrectionAction({
        targetType,
        targetId,
        action,
        changes:
          action === "CHANGE"
            ? {
                amount: changed.amount ? amount : null,
                date: changed.date ? date : null,
                bank_account_id: changed.account ? accountId : null,
                reference: changed.reference ? reference.trim() : null,
                description: changed.description ? description.trim() : null,
              }
            : {},
        reason: reason.trim(),
      });
      if (res.ok) {
        setOpen(false);
        reset();
      }
      setResult({ ok: res.ok, text: res.message });
    });
  }

  const steps = action ? whatWillHappen(targetType, action, changed) : [];

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        icon={<PencilLine size={13} />}
        onClick={() => setOpen(true)}
        hint={CORRECTION_INFO}
      >
        Corregir
      </Button>
      <Modal
        open={open}
        onClose={() => {
          if (!pending) setOpen(false);
        }}
        title={`Pedir corrección · ${label}`}
        size="lg"
      >
        <div className="flex max-h-[75vh] flex-col gap-4 overflow-y-auto pr-1 text-sm">
          <div className="flex gap-2 rounded-[var(--radius-md)] border border-brand-accent/30 bg-brand-accent-light px-3 py-2.5 text-brand-text">
            <ShieldCheck size={18} className="mt-0.5 shrink-0 text-brand-accent" aria-hidden />
            <p>
              <strong>Así funciona:</strong> 1) pides la corrección aquí · 2) otra persona de Administración o
              Finanzas la revisa y la aprueba · 3) se aplica sola. <strong>Mientras tanto no cambia nada.</strong>
            </p>
          </div>

          <div>
            <p className="mb-2 font-medium text-brand-text">1. ¿Qué pasó?</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setAction("CHANGE")}
                className={`flex items-start gap-2 rounded-[var(--radius-md)] border px-3 py-2.5 text-left transition-colors ${
                  action === "CHANGE" ? "border-brand-accent bg-brand-accent-light" : "border-brand-border hover:bg-brand-surface-hover"
                }`}
              >
                <PencilLine size={16} className="mt-0.5 shrink-0 text-brand-accent" aria-hidden />
                <span>
                  <span className="block font-medium text-brand-text">Un dato está mal</span>
                  <span className="block text-xs text-brand-muted">
                    El monto, la fecha, la cuenta o la referencia. Se corrige solo lo que cambies.
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setAction("VOID")}
                className={`flex items-start gap-2 rounded-[var(--radius-md)] border px-3 py-2.5 text-left transition-colors ${
                  action === "VOID" ? "border-brand-danger bg-brand-danger-bg" : "border-brand-border hover:bg-brand-surface-hover"
                }`}
              >
                <Ban size={16} className="mt-0.5 shrink-0 text-brand-danger" aria-hidden />
                <span>
                  <span className="block font-medium text-brand-text">No debió registrarse</span>
                  <span className="block text-xs text-brand-muted">
                    Ej. se registró dos veces o no era de aquí. Se anula completo.
                  </span>
                </span>
              </button>
            </div>
          </div>

          {action === "CHANGE" && (
            <div>
              <p className="mb-1 font-medium text-brand-text">2. Escribe el dato correcto</p>
              <p className="mb-2 text-xs text-brand-muted">Cambia solo lo que está mal; lo demás déjalo igual.</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {allowMoneyChange ? (
                  <MoneyInput
                    label={`Monto correcto (${current.currency})`}
                    name="correction_amount"
                    defaultValue={current.amount}
                    onValueChange={setAmount}
                    hint={`Hoy: ${formatMoney(current.amount, current.currency)}`}
                    error={amount <= 0 ? "Debe ser mayor que 0." : undefined}
                  />
                ) : (
                  <div className="rounded-[var(--radius-md)] bg-brand-surface-hover px-3 py-2 text-xs text-brand-muted">
                    <Info size={13} className="mr-1 inline" aria-hidden />
                    {moneyChangeBlockedReason ?? "El monto y la cuenta no se pueden cambiar aquí: elige «No debió registrarse» y regístralo de nuevo."}
                  </div>
                )}
                <Input
                  label="Fecha correcta"
                  type="date"
                  value={date}
                  max={todayISO()}
                  onChange={(e) => setDate(e.target.value)}
                  hint={`Hoy: ${formatDate(current.date)}`}
                />
                {allowMoneyChange && (
                  <Select
                    label="Cuenta correcta"
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    hint={`Hoy: ${current.accountName ?? "—"}. Solo cuentas en ${accCurrency}.`}
                    info="La cuenta donde de verdad entró o salió el dinero. Si fue una cuenta en otra moneda, elige «No debió registrarse» y regístralo de nuevo."
                  >
                    {accountOptions.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </Select>
                )}
                <Input
                  label="Referencia correcta"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Ej. número de transferencia"
                  hint={`Hoy: ${current.reference || "sin referencia"}`}
                />
                {targetType === "bank_transaction" && (
                  <Input
                    label="Descripción correcta"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    hint={`Hoy: ${current.description || "—"}`}
                  />
                )}
              </div>
              {!anyChange && (
                <p className="mt-2 text-xs text-brand-warning">Todavía no cambiaste ningún dato.</p>
              )}
            </div>
          )}

          {action && (
            <>
              <Textarea
                label={`${action === "CHANGE" ? "3" : "2"}. ¿Por qué? (motivo)`}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                required
                placeholder={
                  action === "VOID" ? "Ej. Se registró dos veces el mismo pago" : "Ej. Se digitó un cero de más en el monto"
                }
                hint={reasonOk ? "Lo verá quien aprueba y queda en la Auditoría." : `Mínimo 10 letras (llevas ${reason.trim().length}).`}
              />
              <div className="rounded-[var(--radius-md)] border border-brand-border bg-brand-surface-hover px-3 py-2.5">
                <p className="mb-1 flex items-center gap-1.5 font-medium text-brand-text">
                  <Info size={14} className="text-brand-accent" aria-hidden /> Qué va a pasar
                </p>
                <ul className="list-disc space-y-0.5 pl-5 text-xs text-brand-text">
                  {steps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            </>
          )}

          <div className="flex justify-end gap-3 border-t border-brand-border pt-3">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button
              variant={action === "VOID" ? "danger" : "primary"}
              loading={pending}
              disabled={!canSend}
              onClick={send}
              hint="Envía la solicitud. No cambia nada hasta que otra persona la apruebe."
            >
              Enviar para aprobación
            </Button>
          </div>
        </div>
      </Modal>
      <ResultDialog
        open={result !== null}
        tone={result?.ok ? "success" : "danger"}
        title={result?.ok ? "Solicitud enviada" : "No se pudo enviar"}
        onClose={() => setResult(null)}
      >
        <p className="text-brand-text">{result?.text}</p>
      </ResultDialog>
    </>
  );
}

/** Etiqueta para un registro anulado o con corrección pendiente. */
export function CorrectionStateBadge({
  voided,
  voidReason,
  pending,
}: {
  voided?: boolean;
  voidReason?: string | null;
  pending?: boolean;
}) {
  if (voided)
    return (
      <span
        title={voidReason ? `Motivo: ${voidReason}` : "Anulado por una corrección aprobada."}
        className="inline-flex items-center gap-1 rounded-full bg-brand-danger-bg px-2 py-0.5 text-xs font-medium text-brand-danger"
      >
        <Ban size={11} aria-hidden /> Anulado
      </span>
    );
  if (pending)
    return (
      <a
        href="/payments?tab=correcciones"
        title="Hay una corrección esperando aprobación. Mientras tanto no cambia nada."
        className="inline-flex items-center gap-1 rounded-full bg-brand-warning-bg px-2 py-0.5 text-xs font-medium text-brand-warning hover:underline"
      >
        <PencilLine size={11} aria-hidden /> Corrección pendiente
      </a>
    );
  return null;
}
