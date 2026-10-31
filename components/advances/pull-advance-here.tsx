"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowDownToLine } from "lucide-react";
import { useOverdraftConfirmAction } from "@/components/ui/overdraft-confirm";
import { transferAdvanceAction, type AdvanceActionState } from "@/features/advances/actions";
import { Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { FormFooter } from "@/components/payments/form-section";
import { formatMoney } from "@/lib/utils/money";

const initialState: AdvanceActionState = { error: null };

/**
 * Aviso en la cotización: el cliente tiene anticipos «sin cotización ni proyecto»
 * (a su favor). «Pasar aquí» los liga a esta cotización sin mover dinero.
 */
export function PullAdvanceHere({
  target,
  targetLabel,
  advances,
  canTransfer,
}: {
  /** «quotation:<id>» o «project:<id>». */
  target: string;
  targetLabel: string;
  advances: { id: string; number: string; available: number; currency: string }[];
  canTransfer: boolean;
}) {
  const total = advances.reduce((acc, a) => acc + a.available, 0);
  const currency = advances[0]?.currency;
  return (
    <div className="mx-4 mt-3 rounded-[var(--radius-md)] border border-brand-warning/30 bg-brand-warning-bg px-3 py-2.5 text-sm text-brand-text">
      <p>
        Este cliente tiene <strong>{formatMoney(total, currency)}</strong> a su favor sin ligar a ningún evento
        (anticipo «solo del cliente»). Si es para {targetLabel}, pásalo aquí: no se mueve dinero y queda en el historial.
      </p>
      <ul className="mt-2 flex flex-col gap-2">
        {advances.map((a) => (
          <PullRow key={a.id} advance={a} target={target} canTransfer={canTransfer} />
        ))}
      </ul>
      {!canTransfer && (
        <p className="mt-2 text-xs text-brand-muted">
          Pasar un anticipo lo hace Administración o Finanzas.
        </p>
      )}
    </div>
  );
}

function PullRow({
  advance,
  target,
  canTransfer,
}: {
  advance: { id: string; number: string; available: number; currency: string };
  target: string;
  canTransfer: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending, dialogs, formKey] = useOverdraftConfirmAction(
    transferAdvanceAction.bind(null, advance.id),
    initialState,
  );
  return (
    <li className="rounded-[var(--radius-md)] bg-brand-surface px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>
          <Link href={`/advances/${advance.id}`} className="font-semibold text-brand-accent hover:underline">
            {advance.number}
          </Link>{" "}
          · disponible <strong>{formatMoney(advance.available, advance.currency)}</strong>
        </span>
        {canTransfer && !open && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            icon={<ArrowDownToLine size={14} />}
            onClick={() => setOpen(true)}
            hint="Liga este anticipo a esta cotización. No mueve dinero; pide un motivo."
          >
            Pasar aquí
          </Button>
        )}
      </div>
      {open && (
        <form key={formKey} action={formAction} className="mt-2 space-y-2">
          <input type="hidden" name="target" value={target} />
          <Textarea
            label="Motivo"
            name="reason"
            rows={2}
            required
            defaultValue="El cliente usará este dinero para este evento"
          />
          <FormFooter error={state.error}>
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" loading={pending}>
              Pasar anticipo aquí
            </Button>
          </FormFooter>
        </form>
      )}
      {dialogs}
    </li>
  );
}
