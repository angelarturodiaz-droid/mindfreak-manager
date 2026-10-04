"use client";

import { useState, useTransition } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { toast } from "@/components/ui/toaster";
import { formatMoney } from "@/lib/utils/money";
import { FIELD_HINTS } from "@/lib/ui/field-hints";
import { overrideExpenseFiscalAction } from "@/features/expenses/actions";

/**
 * "Ajustar retenciones": cambio manual de lo retenido, con motivo. Solo
 * para quien aprueba gastos; queda registrado en la auditoría.
 */
export function OverrideFiscalButton({
  expenseId,
  currency,
  total,
  tax,
  isrWithheld,
  itbisWithheld,
}: {
  expenseId: string;
  currency: string;
  total: number;
  tax: number;
  isrWithheld: number;
  itbisWithheld: number;
}) {
  const [open, setOpen] = useState(false);
  const [isr, setIsr] = useState(isrWithheld);
  const [itbis, setItbis] = useState(itbisWithheld);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const net = Math.round((total - isr - itbis) * 100) / 100;

  return (
    <>
      <Button type="button" variant="ghost" size="sm" icon={<SlidersHorizontal size={14} />} hint={FIELD_HINTS.fiscalOverride} onClick={() => setOpen(true)}>
        Ajustar
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Ajustar retenciones manualmente">
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            startTransition(async () => {
              const res = await overrideExpenseFiscalAction(expenseId, { isrWithheld: isr, itbisWithheld: itbis, reason });
              if (res.error) {
                setError(res.error);
                return;
              }
              toast.success("Retenciones ajustadas.");
              setOpen(false);
            });
          }}
        >
          <p className="text-xs text-brand-muted">
            Úsalo solo cuando tu contador te indique un tratamiento distinto al que calculó el sistema. El cambio queda
            guardado con tu nombre y el motivo.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <MoneyInput label="ISR retenido" name="isr" defaultValue={isrWithheld} min={0} onValueChange={setIsr} />
            <MoneyInput
              label="ITBIS retenido"
              name="itbis"
              defaultValue={itbisWithheld}
              min={0}
              onValueChange={setItbis}
              hint={`ITBIS de la factura: ${formatMoney(tax, currency)}`}
            />
          </div>
          <p className="text-sm text-brand-text">
            Neto a pagar al proveedor:{" "}
            <strong className={net < 0 ? "text-brand-danger" : "text-brand-primary"}>{formatMoney(net, currency)}</strong>
          </p>
          <Textarea
            label="Motivo del ajuste"
            name="reason"
            required
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ej. El contador indica que el proveedor está exento según certificación DGII del 01/10/2026."
          />
          {error && <p className="text-sm text-brand-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={pending}>
              Guardar ajuste
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
