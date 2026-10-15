"use client";

import { Plus, Trash2 } from "lucide-react";
import { Input, Select } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { Button } from "@/components/ui/button";
import { InfoHint } from "@/components/ui/info-hint";
import { formatMoney } from "@/lib/utils/money";
import {
  WITHHOLDING_TYPES,
  WITHHOLDING_TYPE_LABELS,
  CERT_INFO,
  certificateToDocument,
  type WithholdingType,
} from "@/features/payments/withholdings";

export type WithholdingRow = {
  id: number;
  type: WithholdingType;
  /** Moneda de la factura (lo que rebaja el saldo). */
  amount: number;
  /** Solo facturas en otra moneda: monto del certificado de la DGII en RD$. */
  certificate_amount: number;
  certificate_number: string;
  notes: string;
  /** El usuario corrigió el monto a mano (ya no se calcula del certificado). */
  amountManual: boolean;
  /** Cambia para volver a montar el campo de monto con el valor calculado. */
  amountKey: number;
};

let nextId = 1;
export function newWithholdingRow(): WithholdingRow {
  return {
    id: nextId++,
    type: "ITBIS",
    amount: 0,
    certificate_amount: 0,
    certificate_number: "",
    notes: "",
    amountManual: false,
    amountKey: 0,
  };
}

/** Lo que se manda al servidor (campo oculto `withholdings`). */
export function withholdingsPayload(rows: WithholdingRow[], foreign: boolean) {
  return rows.map((r) => ({
    type: r.type,
    amount: r.amount,
    certificate_amount: foreign && r.certificate_amount > 0 ? r.certificate_amount : undefined,
    certificate_number: r.certificate_number,
    notes: r.notes,
  }));
}

/**
 * Filas de "Retenciones del cliente" en Registrar cobro. Factura en pesos:
 * se escribe el monto. Factura en otra moneda (ej. USD): primero el monto
 * del certificado en RD$ (lo que dice el papel de la DGII) y se convierte
 * solo con la tasa de la factura; el monto en la moneda de la factura se
 * puede corregir a mano.
 */
export function CustomerWithholdingsFields({
  rows,
  onChange,
  invoiceCurrency,
  functionalCurrency,
  invoiceRate,
}: {
  rows: WithholdingRow[];
  onChange: (rows: WithholdingRow[]) => void;
  invoiceCurrency: string;
  functionalCurrency: string;
  /** Tasa de la factura (RD$ por 1 unidad de su moneda). */
  invoiceRate: number;
}) {
  const foreign = invoiceCurrency !== functionalCurrency;

  function update(id: number, patch: Partial<WithholdingRow>) {
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  return (
    <div className="flex flex-col gap-3">
      {rows.map((r, i) => (
        <div
          key={r.id}
          className="grid grid-cols-1 items-start gap-3 rounded-[var(--radius-md)] border border-brand-border bg-brand-background/60 p-3 sm:grid-cols-12"
        >
          <div className="sm:col-span-2">
            <Select
              label={`Tipo${rows.length > 1 ? ` (${i + 1})` : ""}`}
              name={`wh_type_${r.id}`}
              value={r.type}
              onChange={(e) => update(r.id, { type: e.target.value as WithholdingType })}
            >
              {WITHHOLDING_TYPES.map((t) => (
                <option key={t} value={t}>
                  {WITHHOLDING_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          </div>

          {foreign && (
            <div className="sm:col-span-3">
              <MoneyInput
                label={`Monto del certificado (${functionalCurrency})`}
                name={`wh_cert_${r.id}`}
                defaultValue={r.certificate_amount || ""}
                hint="Lo que dice el certificado de la DGII."
                onValueChange={(v) =>
                  update(
                    r.id,
                    r.amountManual
                      ? { certificate_amount: v }
                      : {
                          certificate_amount: v,
                          amount: certificateToDocument(v, invoiceRate),
                          amountKey: r.amountKey + 1,
                        },
                  )
                }
              />
            </div>
          )}

          <div className="sm:col-span-3">
            <MoneyInput
              key={`amt-${r.id}-${r.amountKey}`}
              label={`Monto retenido (${invoiceCurrency})`}
              name={`wh_amount_${r.id}`}
              defaultValue={r.amount || ""}
              hint={
                foreign
                  ? r.amountManual
                    ? "Corregido a mano."
                    : `Certificado ÷ tasa de la factura (${invoiceRate}).`
                  : "Lo que el cliente descontó del pago."
              }
              onValueChange={(v) => update(r.id, { amount: v, amountManual: foreign ? true : r.amountManual })}
            />
          </div>

          <div className="sm:col-span-3">
            <Input
              label="N.º de certificado"
              info={CERT_INFO}
              name={`wh_num_${r.id}`}
              value={r.certificate_number}
              onChange={(e) => update(r.id, { certificate_number: e.target.value })}
              placeholder="Ej. CR-2026-00123 (opcional)"
            />
          </div>

          {!foreign && (
            <div className="sm:col-span-3">
              <Input
                label="Nota"
                name={`wh_notes_${r.id}`}
                value={r.notes}
                onChange={(e) => update(r.id, { notes: e.target.value })}
                placeholder="Opcional"
              />
            </div>
          )}
          <div className="sm:col-span-1 sm:pt-6">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              icon={<Trash2 size={15} />}
              aria-label="Quitar esta retención"
              hint="Quitar esta retención"
              onClick={() => onChange(rows.filter((x) => x.id !== r.id))}
            />
          </div>

          {foreign && r.amount > 0 && r.certificate_amount > 0 && (
            <p className="text-xs text-brand-muted sm:col-span-12">
              {formatMoney(r.certificate_amount, functionalCurrency)} ÷ {invoiceRate} ={" "}
              <strong className="text-brand-text">{formatMoney(r.amount, invoiceCurrency)}</strong> rebaja el saldo de la
              factura.
            </p>
          )}
        </div>
      ))}

      {rows.length < 10 && (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            icon={<Plus size={14} />}
            onClick={() => onChange([...rows, newWithholdingRow()])}
            hint="Por ejemplo, ISR e ITBIS en el mismo cobro."
          >
            Agregar otra retención
          </Button>
          <InfoHint text="El certificado (PDF o foto) se adjunta después de guardar, en la lista de cobros de la factura: Agregar certificado." />
        </div>
      )}
    </div>
  );
}
