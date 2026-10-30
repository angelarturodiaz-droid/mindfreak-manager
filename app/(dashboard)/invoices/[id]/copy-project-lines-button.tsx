"use client";

import { useTransition } from "react";
import { CopyPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { copyPendingProjectLinesAction } from "@/features/invoices/actions";

/** Copia de una vez las líneas del proyecto que todavía no se han facturado. */
export function CopyProjectLinesButton({ invoiceId, projectNumber }: { invoiceId: string; projectNumber: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="primary"
      size="sm"
      icon={<CopyPlus size={14} />}
      loading={pending}
      hint={`Copia las líneas de ${projectNumber} que todavía no están en ninguna factura (de la cotización aprobada, con su ITBIS). Después puedes quitar o cambiar lo que no vaya en esta factura.`}
      onClick={() =>
        startTransition(async () => {
          try {
            const { copied } = await copyPendingProjectLinesAction(invoiceId);
            toast.success(
              `Se ${copied === 1 ? "copió 1 línea" : `copiaron ${copied} líneas`} del proyecto. Revísalas y pulsa «Emitir factura».`,
            );
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "No se pudieron copiar las líneas.");
          }
        })
      }
    >
      Copiar todas las líneas pendientes del proyecto
    </Button>
  );
}
