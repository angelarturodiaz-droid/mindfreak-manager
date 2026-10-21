"use client";

import { useState, useTransition } from "react";
import { Copy } from "lucide-react";
import { duplicateInvoiceAction } from "@/features/invoices/actions";
import { Button } from "@/components/ui/button";
import { ResultDialog } from "@/components/ui/result-dialog";

/**
 * Duplicar factura. Si la factura viene de una cotización sin proyecto, la
 * copia sale como factura directa (una cotización = una factura); se avisa
 * antes que, para una venta nueva, lo correcto es duplicar la cotización.
 */
export function DuplicateInvoiceButton({
  invoiceId,
  fromQuotation,
}: {
  invoiceId: string;
  /** Número de la cotización (sin proyecto) de donde viene, si aplica. */
  fromQuotation?: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState(false);

  function run() {
    setConfirm(false);
    startTransition(() => duplicateInvoiceAction(invoiceId));
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        loading={isPending}
        icon={<Copy size={14} />}
        onClick={() => (fromQuotation ? setConfirm(true) : run())}
      >
        Duplicar factura
      </Button>
      <ResultDialog
        open={confirm}
        tone="warning"
        title="¿Duplicar esta factura?"
        onClose={() => setConfirm(false)}
        actions={
          <>
            <Button type="button" variant="outline" onClick={() => setConfirm(false)}>
              No, volver
            </Button>
            <Button type="button" icon={<Copy size={14} />} onClick={run}>
              Sí, duplicar
            </Button>
          </>
        }
      >
        Esta factura viene de la cotización {fromQuotation}, y cada cotización tiene una sola factura. La copia saldrá
        como <strong>factura directa</strong> (sin cotización). Si es una venta nueva para el cliente, lo recomendable es
        <strong> duplicar la cotización</strong> y facturar la nueva, para que quede lo que el cliente aprobó.
      </ResultDialog>
    </>
  );
}
