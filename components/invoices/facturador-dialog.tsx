"use client";

import { useState } from "react";
import { Check, ClipboardCopy, ExternalLink, FileCheck2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toaster";
import type { FacturadorData, FacturadorRow } from "@/features/invoices/facturador";
import { ECF_FIELD_INFO } from "@/lib/dgii/catalogs";

function CopyBtn({ text, label }: { text?: string; label: string }) {
  const [done, setDone] = useState(false);
  if (!text) return <span className="w-[70px]" />;
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          toast.error("No se pudo copiar. Selecciona el texto y cópialo a mano.");
        }
      }}
      title={`Copiar «${label}»`}
      className={`inline-flex w-[70px] shrink-0 items-center justify-center gap-1 rounded-[var(--radius-md)] border px-2 py-1 text-xs transition-colors ${
        done ? "border-brand-success/40 bg-brand-success-bg text-brand-success" : "border-brand-border text-brand-muted hover:border-brand-accent hover:text-brand-accent"
      }`}
    >
      {done ? <Check size={12} /> : <ClipboardCopy size={12} />} {done ? "Listo" : "Copiar"}
    </button>
  );
}

function Rows({ rows }: { rows: FacturadorRow[] }) {
  return (
    <ul className="divide-y divide-brand-border rounded-[var(--radius-md)] border border-brand-border">
      {rows.map((r) => (
        <li key={r.n + r.label} className="flex items-center gap-3 px-3 py-1.5 text-sm">
          <span className="w-10 shrink-0 text-xs font-semibold tabular-nums text-brand-accent">{r.n}</span>
          <span className="w-44 shrink-0 text-xs text-brand-muted">{r.label}</span>
          <span className={`min-w-0 flex-1 break-words ${r.muted ? "text-brand-muted" : "font-medium text-brand-text"}`}>
            {r.value}
            {r.note && <span className="block text-[11px] font-normal text-brand-muted">{r.note}</span>}
          </span>
          <CopyBtn text={r.copy} label={r.label} />
        </li>
      ))}
    </ul>
  );
}

/** «Datos para el Facturador DGII»: todo en el orden y numeración del Facturador, con «Copiar». */
export function FacturadorDialog({ data, invoiceNumber }: { data: FacturadorData; invoiceNumber: string }) {
  const [open, setOpen] = useState(false);
  const warnings = data.checks.filter((c) => !c.ok).length;
  return (
    <>
      <Button
        type="button"
        variant="outline"
        icon={<FileCheck2 size={15} />}
        onClick={() => setOpen(true)}
        hint="Abre todos los datos en el mismo orden del Facturador Gratuito DGII, con un botón Copiar en cada uno."
      >
        Datos para el Facturador DGII
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Datos para el Facturador DGII · ${invoiceNumber}`} size="lg">
        <div className="flex flex-col gap-5 text-sm">
          <div className="rounded-[var(--radius-md)] border border-brand-accent/30 bg-brand-accent-light px-3 py-2 text-brand-text">
            Abre el <strong>Facturador Gratuito</strong> en la Oficina Virtual de la DGII y llena cada campo con el número que ves aquí
            (1, 2, 3…). Usa <strong>Copiar</strong> y pega. Los montos van sin símbolo, con punto decimal. Nada de esto cambia la factura del ERP.
            <a href="https://dgii.gov.do/" target="_blank" rel="noreferrer" className="ml-1 inline-flex items-center gap-0.5 text-brand-accent hover:underline">
              dgii.gov.do <ExternalLink size={11} />
            </a>
          </div>

          <section className="flex flex-col gap-2">
            <h3 className="font-semibold text-brand-text">Paso 1 · Identificación y tipo (1–14)</h3>
            <Rows rows={data.header} />
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="font-semibold text-brand-text">Paso 2 · Líneas (15–24) · una por cada «Agregar ítem»</h3>
            <div className="overflow-x-auto rounded-[var(--radius-md)] border border-brand-border">
              <table className="w-full min-w-[640px] text-xs">
                <thead className="bg-brand-background text-brand-muted">
                  <tr>
                    <th className="px-2 py-1.5 text-left">#</th>
                    <th className="px-2 py-1.5 text-left">15 Descripción</th>
                    <th className="px-2 py-1.5 text-left">16 Unidad</th>
                    <th className="px-2 py-1.5 text-left">17 Tipo</th>
                    <th className="px-2 py-1.5 text-right">18 Cant.</th>
                    <th className="px-2 py-1.5 text-right">19 Precio sin ITBIS</th>
                    <th className="px-2 py-1.5 text-left">20 ITBIS</th>
                    <th className="px-2 py-1.5 text-right">21 Descuento (monto)</th>
                    <th className="px-2 py-1.5 text-right">24 Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border">
                  {data.lines.map((l) => (
                    <tr key={l.index} className={l.isCommission ? "bg-brand-background" : ""}>
                      <td className="px-2 py-1.5 tabular-nums text-brand-muted">{l.index}</td>
                      <td className="px-2 py-1.5 text-brand-text">
                        <span className="flex items-center gap-1.5">
                          {l.description}
                          <CopyBtn text={l.description} label="Descripción" />
                        </span>
                        {l.isCommission && <span className="block text-[11px] text-brand-muted">Comisión de la factura: va como una línea más</span>}
                      </td>
                      <td className="px-2 py-1.5">{l.unit}</td>
                      <td className="px-2 py-1.5">{l.kind}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{l.quantity}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{l.price}</td>
                      <td className="px-2 py-1.5">{l.itbis}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{l.discount}</td>
                      <td className="px-2 py-1.5 text-right font-medium tabular-nums">{l.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="flex list-disc flex-col gap-0.5 pl-5 text-xs text-brand-muted">
              <li>{ECF_FIELD_INFO.discount}</li>
              <li>{ECF_FIELD_INFO.zeroVsExempt}</li>
              <li>{ECF_FIELD_INFO.retentions}</li>
            </ul>
            <Rows rows={data.options} />
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="font-semibold text-brand-text">Paso 3 · Cuadre: los totales que debe mostrar el Facturador (27–39)</h3>
            <Rows rows={data.totals} />
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="flex items-center gap-2 font-semibold text-brand-text">
              Paso 4 · Revisión final
              {warnings > 0 ? (
                <span className="rounded-full bg-brand-warning-bg px-2 py-0.5 text-xs font-medium text-brand-warning">{warnings} por revisar</span>
              ) : (
                <span className="rounded-full bg-brand-success-bg px-2 py-0.5 text-xs font-medium text-brand-success">Todo bien</span>
              )}
            </h3>
            <ul className="flex flex-col gap-1">
              {data.checks.map((c) => (
                <li key={c.text} className="flex items-start gap-2 text-sm">
                  {c.ok ? <Check size={15} className="mt-0.5 shrink-0 text-brand-success" /> : <TriangleAlert size={15} className="mt-0.5 shrink-0 text-brand-warning" />}
                  <span className={c.ok ? "text-brand-text" : "font-medium text-brand-text"}>{c.text}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="flex flex-col gap-1 rounded-[var(--radius-md)] bg-brand-background p-3">
            <h3 className="font-semibold text-brand-text">Paso 5 · Generar, firmar y conservar</h3>
            <ol className="flex list-decimal flex-col gap-0.5 pl-5 text-brand-text">
              <li>En el Facturador, revisa que los totales (27–39) sean iguales a los de aquí.</li>
              <li>Genera el e-CF y fírmalo.</li>
              <li>
                Vuelve aquí y en <strong>Factura electrónica (e-CF)</strong> anota el <strong>e-NCF</strong>, el <strong>código de seguridad</strong> y la
                <strong> fecha de firma</strong>. Después adjunta ahí mismo el <strong>PDF y el XML</strong> que generó el Facturador: el PDF de la DGII es el que se le envía al cliente.
              </li>
            </ol>
          </section>

          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cerrar
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
