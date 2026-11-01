"use client";

import { useState, useTransition } from "react";
import { FileSignature, Info } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { InfoHint } from "@/components/ui/info-hint";
import { ResultDialog } from "@/components/ui/result-dialog";
import { getRetentionLetterDataAction, uploadRetentionLetterAction } from "@/features/retention-letters/actions";
import {
  ADDRESSEE_INFO,
  ADDRESSEE_LABELS,
  letterParagraph,
  type LetterAddressee,
} from "@/features/retention-letters/schema";
import { todayISO } from "@/lib/utils/dates";

const SIGNER_KEY = "mf.retentionLetter.signer";

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

function readSigner(): { name: string; title: string } | null {
  try {
    const raw = window.localStorage.getItem(SIGNER_KEY);
    return raw ? (JSON.parse(raw) as { name: string; title: string }) : null;
  } catch {
    return null;
  }
}

/**
 * «Carta de retención (PDF)» del gasto: certificación de lo que Mindfreak le
 * retuvo al proveedor (ISR/ITBIS). Toma todo del gasto y de sus pagos.
 */
export function RetentionLetterButton({
  expenseId,
  existingNumber,
  supplier,
  itbisPct,
  isrPct,
  defaultSigner,
  addresseeName,
}: {
  expenseId: string;
  existingNumber: string | null;
  supplier: { name: string; tax_id: string | null };
  itbisPct: number;
  isrPct: number;
  defaultSigner: { name: string | null; title: string | null };
  addresseeName: string;
}) {
  const [open, setOpen] = useState(false);
  const [letterDate, setLetterDate] = useState(todayISO());
  const [addressee, setAddressee] = useState<LetterAddressee>("DGII");
  const [signerName, setSignerName] = useState(defaultSigner.name ?? "");
  const [signerTitle, setSignerTitle] = useState(defaultSigner.title ?? "");
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function openDialog() {
    const saved = readSigner();
    if (saved) {
      setSignerName(saved.name);
      setSignerTitle(saved.title);
    }
    setOpen(true);
  }

  function generate() {
    startTransition(async () => {
      try {
        window.localStorage.setItem(SIGNER_KEY, JSON.stringify({ name: signerName, title: signerTitle }));
      } catch {
        /* sin almacenamiento: no pasa nada */
      }
      const { data, error } = await getRetentionLetterDataAction(expenseId, { letterDate, addressee, signerName, signerTitle });
      if (error || !data) {
        setResult({ ok: false, text: error ?? "No se pudieron leer los datos del gasto." });
        return;
      }
      const [{ pdf }, { RetentionLetterPdfDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/lib/pdf/retention-letter-document"),
      ]);
      const blob = await pdf(RetentionLetterPdfDocument(data)).toBlob();
      const up = await uploadRetentionLetterAction(expenseId, data.number, await blobToBase64(blob));
      if (up.error || !up.url) {
        setResult({ ok: false, text: up.error ?? "No se pudo guardar la carta." });
        return;
      }
      setOpen(false);
      window.open(up.url, "_blank");
      setResult({
        ok: true,
        text: `Carta ${data.number} lista: se abrió en otra pestaña y quedó guardada en «Documentos» de este gasto. Imprímela, fírmala, séllala y entrégasela al proveedor.`,
      });
    });
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        icon={<FileSignature size={14} />}
        onClick={openDialog}
        hint="Certificación de lo que le retuvimos al proveedor (ISR/ITBIS), con el logo de Mindfreak. El proveedor la usa como soporte ante la DGII."
      >
        Carta de retención (PDF){existingNumber ? ` · ${existingNumber}` : ""}
      </Button>
      <Modal open={open} onClose={() => !pending && setOpen(false)} title="Carta de retención al proveedor" size="lg">
        <div className="flex max-h-[75vh] flex-col gap-4 overflow-y-auto pr-1 text-sm">
          <div className="flex gap-2 rounded-[var(--radius-md)] border border-brand-accent/30 bg-brand-accent-light px-3 py-2.5 text-brand-text">
            <Info size={17} className="mt-0.5 shrink-0 text-brand-accent" aria-hidden />
            <p>
              Es la constancia de lo que <strong>le retuvimos</strong> a {supplier.name}. Todo sale del gasto: NCF, montos,
              retenciones y la fecha del pago. {existingNumber ? `Ya tiene el número ${existingNumber}: se mantiene.` : "Al generarla recibe su número CR."}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Fecha de la carta"
              type="date"
              value={letterDate}
              max={todayISO()}
              onChange={(e) => setLetterDate(e.target.value)}
              info="La fecha que aparece en la carta (normalmente hoy)."
            />
          </div>

          <div>
            <p className="mb-2 flex items-center gap-1 font-medium text-brand-text">
              ¿A quién va dirigida?
              <InfoHint text="La DGII no exige un modelo único: la carta se le entrega al proveedor. Lo usual es dirigirla al Director General de la DGII." />
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {(Object.keys(ADDRESSEE_LABELS) as LetterAddressee[]).map((k) => (
                <label
                  key={k}
                  title={ADDRESSEE_INFO[k]}
                  className={`flex cursor-pointer items-start gap-2 rounded-[var(--radius-md)] border px-3 py-2 ${
                    addressee === k ? "border-brand-accent bg-brand-accent-light" : "border-brand-border hover:bg-brand-surface-hover"
                  }`}
                >
                  <input type="radio" name="addressee" className="mt-1" checked={addressee === k} onChange={() => setAddressee(k)} />
                  <span>
                    <span className="block font-medium text-brand-text">{ADDRESSEE_LABELS[k]}</span>
                    <span className="block text-xs text-brand-muted">
                      {k === "DGII" ? addresseeName || "Configúralo en Documentos" : k === "SUPPLIER" ? supplier.name : "Sin nombre"}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Quién firma"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              placeholder="Ej. Angel Díaz"
              info="Sale debajo de la línea de firma. Se recuerda en esta computadora para la próxima carta."
            />
            <Input
              label="Cargo"
              value={signerTitle}
              onChange={(e) => setSignerTitle(e.target.value)}
              placeholder="Ej. Gerente General"
            />
          </div>

          <div className="rounded-[var(--radius-md)] border border-brand-border bg-brand-surface-hover px-3 py-2.5">
            <p className="mb-1 font-medium text-brand-text">Así dirá el texto principal</p>
            <p className="text-xs leading-relaxed text-brand-text">{letterParagraph({ itbisPct, isrPct, supplier })}</p>
            <p className="mt-1 text-[11px] text-brand-muted">
              Los porcentajes salen solos de lo retenido en el gasto. El párrafo legal y el nombre del Director de la DGII se
              cambian en Configuración → Documentos.
            </p>
          </div>

          <div className="flex justify-end gap-3 border-t border-brand-border pt-3">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button loading={pending} onClick={generate} icon={<FileSignature size={14} />} hint="Genera el PDF, lo abre y lo guarda en Documentos del gasto.">
              Generar carta
            </Button>
          </div>
        </div>
      </Modal>
      <ResultDialog
        open={result !== null}
        tone={result?.ok ? "success" : "danger"}
        title={result?.ok ? "Carta generada" : "No se pudo generar"}
        onClose={() => setResult(null)}
      >
        <p className="text-brand-text">{result?.text}</p>
      </ResultDialog>
    </>
  );
}
