"use client";

import { useState, useTransition } from "react";
import { Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResultDialog } from "@/components/ui/result-dialog";
import { createInvoiceFromQuotationAction } from "@/features/invoices/actions";
import { isNavigationSignal } from "@/lib/utils/navigation-signal";

/**
 * Venta sin evento: crea una factura en Borrador con las líneas de la
 * cotización aprobada (sin crear proyecto).
 */
export function InvoiceFromQuotationButton({
  quotationId,
  existing,
}: {
  quotationId: string;
  /** Facturas ya hechas desde esta cotización (ej. el anticipo). */
  existing: { number: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function create() {
    setConfirm(false);
    startTransition(async () => {
      try {
        const r = await createInvoiceFromQuotationAction(quotationId);
        if (r?.error) setError(r.error);
      } catch (e) {
        if (!isNavigationSignal(e)) setError(e instanceof Error ? e.message : "No se pudo crear la factura.");
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant={existing.length ? "outline" : "secondary"}
        size="sm"
        icon={<Receipt size={14} />}
        loading={pending}
        onClick={() => setConfirm(true)}
        hint="Para una venta sin evento: crea una factura en Borrador con las líneas, la comisión, la condición de pago y los datos bancarios de esta cotización, sin crear proyecto. La revisas y la emites."
      >
        {existing.length ? "Otra factura de esta cotización" : "Facturar sin proyecto"}
      </Button>
      <ResultDialog
        open={confirm}
        tone="warning"
        title={existing.length ? "¿Hacer otra factura de esta cotización?" : "¿Facturar esta cotización sin proyecto?"}
        onClose={() => setConfirm(false)}
        actions={
          <>
            <Button type="button" variant="outline" onClick={() => setConfirm(false)}>
              No, volver
            </Button>
            <Button type="button" icon={<Receipt size={14} />} onClick={create}>
              Sí, crear factura
            </Button>
          </>
        }
      >
        {existing.length ? (
          <>
            Ya hay {existing.length === 1 ? "una factura" : "facturas"} de esta cotización (
            {existing.map((e) => e.number).join(", ")}). La nueva también copia todas las líneas: ajústalas (ej. el
            balance) antes de emitir.
          </>
        ) : (
          <>
            Se crea una factura en Borrador con las mismas líneas e impuestos que aprobó el cliente. Es para ventas sin
            evento: no se crea proyecto (si es un evento, usa «Convertir a Proyecto»). Revísala y emítela.
          </>
        )}
      </ResultDialog>
      <ResultDialog open={Boolean(error)} tone="danger" title="No se creó la factura" onClose={() => setError(null)}>
        {error}
      </ResultDialog>
    </>
  );
}
