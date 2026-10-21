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
        hint="Crea una factura nueva en Borrador con las mismas líneas. Sirve para ventas que no necesitan cotización, por ejemplo un servicio que se repite cada mes al mismo cliente (inspección, alquiler): copias la anterior, ajustas fecha y montos, y la emites. Para una venta nueva que el cliente debe aprobar, mejor «Duplicar cotización»."
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
        <span className="flex flex-col gap-2">
          <span>
            Esta factura viene de la cotización <strong>{fromQuotation}</strong>, y cada cotización tiene una sola
            factura. La copia saldrá como <strong>factura directa</strong>: no queda amarrada a ninguna cotización (en
            Facturas, su Origen dirá «Directa»).
          </span>
          <span>
            <strong>Úsala para</strong> ventas que no necesitan cotización, por ejemplo un servicio que se repite cada mes
            al mismo cliente.
          </span>
          <span>
            <strong>Si es una venta nueva</strong> que el cliente debe aprobar, vuelve atrás y usa{" "}
            <strong>Duplicar cotización</strong> en {fromQuotation}: la cotización nueva se envía, se aprueba y tendrá su
            propia factura.
          </span>
        </span>
      </ResultDialog>
    </>
  );
}
