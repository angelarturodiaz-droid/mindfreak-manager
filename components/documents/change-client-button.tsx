"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserRoundPen } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { SearchSelect } from "@/components/ui/search-select";
import { ResultDialog } from "@/components/ui/result-dialog";
import { changeInvoiceClientAction } from "@/features/invoices/actions";
import { changeQuotationClientAction } from "@/features/quotations/actions";

/**
 * "Cambiar cliente" de una factura o cotización en Borrador. Si no se puede
 * (viene de un proyecto, etc.), el botón explica por qué en una ventana.
 */
export function ChangeClientButton({
  kind,
  documentId,
  currentClientId,
  clients,
  blockedReason,
}: {
  kind: "invoice" | "quotation";
  documentId: string;
  currentClientId: string;
  clients: { id: string; name: string }[];
  /** Si viene, no se puede cambiar y se muestra este motivo. */
  blockedReason?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ tone: "success" | "danger" | "warning"; title: string; text: string } | null>(null);
  const what = kind === "invoice" ? "factura" : "cotización";

  function save() {
    start(async () => {
      const action = kind === "invoice" ? changeInvoiceClientAction : changeQuotationClientAction;
      const res = await action(documentId, clientId);
      if (res.error) {
        setResult({ tone: "danger", title: "No se cambió el cliente", text: res.error });
      } else {
        setOpen(false);
        setResult({ tone: "success", title: "Cliente cambiado", text: res.success ?? "" });
        router.refresh();
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() =>
          blockedReason
            ? setResult({ tone: "warning", title: "No se puede cambiar el cliente", text: blockedReason })
            : (setClientId(""), setOpen(true))
        }
        className="inline-flex items-center gap-1 text-xs font-medium text-brand-accent hover:underline"
        title={`Cambiar el cliente de esta ${what} (solo en Borrador)`}
      >
        <UserRoundPen size={13} aria-hidden /> Cambiar cliente
      </button>

      {open && (
        <Modal open onClose={() => !pending && setOpen(false)} title={`Cambiar el cliente de la ${what}`}>
          <div className="flex flex-col gap-4 text-sm">
            <p className="text-brand-muted">
              Solo mientras está en Borrador. Las líneas y los montos no cambian.
              {kind === "invoice"
                ? " Después revisa el tipo de NCF: depende de si el cliente nuevo tiene RNC (crédito fiscal) o no (consumidor final)."
                : " Si tenía un contacto del cliente anterior, se quita."}
            </p>
            <SearchSelect
              label="Cliente nuevo"
              name="new_client_id"
              options={clients.filter((c) => c.id !== currentClientId).map((c) => ({ value: c.id, label: c.name }))}
              value={clientId}
              onChange={(v) => setClientId(v)}
              emptyLabel={null}
              placeholder="Escribe el nombre del cliente…"
              required
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                Cancelar
              </Button>
              <Button type="button" onClick={save} loading={pending} disabled={!clientId}>
                Cambiar cliente
              </Button>
            </div>
          </div>
        </Modal>
      )}

      <ResultDialog open={!!result} tone={result?.tone ?? "success"} title={result?.title ?? ""} onClose={() => setResult(null)}>
        <p className="text-sm text-brand-muted">{result?.text}</p>
      </ResultDialog>
    </>
  );
}
