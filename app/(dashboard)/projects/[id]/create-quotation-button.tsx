"use client";

import { useState, useTransition } from "react";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResultDialog } from "@/components/ui/result-dialog";
import { createQuotationFromProjectAction } from "@/features/quotations/actions";
import { isNavigationSignal } from "@/lib/utils/navigation-signal";

/** Proyecto sin cotización: arma una cotización con sus líneas para que el cliente la apruebe. */
export function CreateQuotationButton({ projectId }: { projectId: string }) {
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function create() {
    setConfirm(false);
    startTransition(async () => {
      try {
        const r = await createQuotationFromProjectAction(projectId);
        if (r?.error) setError(r.error);
      } catch (e) {
        if (!isNavigationSignal(e)) setError(e instanceof Error ? e.message : "No se pudo crear la cotización.");
      }
    });
  }

  return (
    <>
      <Button type="button" variant="outline" icon={<FileText size={14} />} loading={pending} onClick={() => setConfirm(true)}>
        Crear cotización con estas líneas
      </Button>
      <ResultDialog
        open={confirm}
        tone="warning"
        title="¿Crear la cotización para el cliente?"
        onClose={() => setConfirm(false)}
        actions={
          <>
            <Button type="button" variant="outline" onClick={() => setConfirm(false)}>
              No, volver
            </Button>
            <Button type="button" icon={<FileText size={14} />} onClick={create}>
              Sí, crear cotización
            </Button>
          </>
        }
      >
        Se crea una cotización en Borrador con estas líneas (con el impuesto de cada servicio o el predeterminado; lo puedes
        revisar ahí). Cuando el cliente la apruebe, pasa a ser la cotización del proyecto y estas líneas quedan fijas.
      </ResultDialog>
      <ResultDialog open={Boolean(error)} tone="danger" title="No se creó la cotización" onClose={() => setError(null)}>
        {error}
      </ResultDialog>
    </>
  );
}
