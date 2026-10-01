"use client";

import { useTransition } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { getDeliveryPdfDataAction } from "@/features/deliveries/actions";

/**
 * Genera el PDF del acuse en el navegador y lo abre en otra pestaña para
 * imprimirlo o guardarlo. El render (`pdf()` de @react-pdf/renderer) se
 * hace aquí y no en el servidor: ver claude/pdf-generacion-cliente.md.
 */
export function PrintDeliveryButton({
  receiptId,
  number,
  label = "Imprimir / descargar PDF",
  variant = "outline",
}: {
  receiptId: string;
  number: string;
  label?: string;
  variant?: "primary" | "outline" | "ghost";
}) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    // Se abre la pestaña ya (en el clic) para que el navegador no la bloquee.
    const win = window.open("", "_blank");
    startTransition(async () => {
      const { data, error } = await getDeliveryPdfDataAction(receiptId);
      if (error || !data) {
        win?.close();
        toast.error(error ?? "No se pudieron obtener los datos del acuse.");
        return;
      }
      try {
        const [{ pdf }, { DeliveryReceiptPdfDocument }] = await Promise.all([
          import("@react-pdf/renderer"),
          import("@/lib/pdf/delivery-receipt-document"),
        ]);
        const blob = await pdf(DeliveryReceiptPdfDocument(data)).toBlob();
        const url = URL.createObjectURL(blob);
        if (win) {
          win.location.href = url;
        } else {
          // Ventanas emergentes bloqueadas: se descarga el archivo.
          const a = document.createElement("a");
          a.href = url;
          a.download = `Acuse-${number}.pdf`;
          a.click();
        }
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } catch (e) {
        win?.close();
        toast.error(e instanceof Error ? e.message : "No se pudo generar el PDF.");
      }
    });
  }

  return (
    <Button type="button" size="sm" variant={variant} icon={<Printer size={14} />} loading={pending} onClick={handleClick}>
      {pending ? "Generando…" : label}
    </Button>
  );
}
