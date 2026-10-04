"use client";

import { useMemo, useState } from "react";
import { Info, TriangleAlert } from "lucide-react";
import { Input, Select } from "@/components/ui/field";
import { InfoHint } from "@/components/ui/info-hint";
import { analyzeTaxId } from "@/lib/fiscal/tax-id";
import { FIELD_HINTS } from "@/lib/ui/field-hints";
import {
  COUNTRIES,
  E_ISSUER_LABELS,
  E_ISSUER_VALUES,
  FISCAL_CONDITIONS,
  FISCAL_CONDITION_LABELS,
  ID_TYPES,
  ID_TYPE_LABELS,
  SUPPLIER_KINDS,
  SUPPLIER_KIND_LABELS,
} from "@/features/suppliers/fiscal";

export type SupplierFiscalDefaults = {
  tax_id?: string | null;
  id_type?: string | null;
  supplier_kind?: string | null;
  fiscal_condition?: string | null;
  tax_residence?: string | null;
  country_code?: string | null;
  foreign_tax_id?: string | null;
  e_issuer?: string | null;
};

/**
 * RNC/Cédula + "Información fiscal" del proveedor, con visualización
 * progresiva: los datos de proveedor extranjero solo aparecen si se marca
 * "Extranjero". Al escribir el RNC/Cédula sugiere el tipo de identificación
 * y el tipo de proveedor (solo si el usuario no los eligió a mano); la
 * condición fiscal nunca se sugiere: la confirma el usuario.
 */
export function SupplierFiscalFields({ defaults = {} }: { defaults?: SupplierFiscalDefaults }) {
  const [taxId, setTaxId] = useState(defaults.tax_id ?? "");
  const [idType, setIdType] = useState(defaults.id_type ?? "");
  const [kind, setKind] = useState(defaults.supplier_kind ?? "");
  const [condition, setCondition] = useState(defaults.fiscal_condition ?? "");
  const [residence, setResidence] = useState(defaults.tax_residence ?? "DO");
  const [touched, setTouched] = useState({ idType: Boolean(defaults.id_type), kind: Boolean(defaults.supplier_kind) });
  const analysis = useMemo(() => analyzeTaxId(taxId), [taxId]);
  const foreign = residence === "EXTRANJERO";

  function onTaxIdChange(value: string) {
    setTaxId(value);
    const a = analyzeTaxId(value);
    if (!foreign && a.suggestedIdType && !touched.idType) setIdType(a.suggestedIdType);
    if (!foreign && a.suggestedSupplierKind && !touched.kind) setKind(a.suggestedSupplierKind);
  }

  const missing = !foreign && (!kind || !condition);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Input
          label={foreign ? "Identificación (opcional)" : "RNC / Cédula"}
          name="tax_id"
          value={taxId}
          onChange={(e) => onTaxIdChange(e.target.value)}
          placeholder={foreign ? "" : "Ej. 1-01-12345-6 o 001-1234567-8"}
          info="Puedes escribirlo con o sin guiones. Con 9 dígitos es un RNC (empresa); con 11, una Cédula (persona)."
        />
        {!foreign && analysis.message && (
          <p
            className={`flex items-start gap-1.5 text-xs ${analysis.tone === "warning" ? "text-brand-warning" : "text-brand-accent"}`}
            role="status"
          >
            {analysis.tone === "warning" ? (
              <TriangleAlert size={13} className="mt-0.5 shrink-0" aria-hidden />
            ) : (
              <Info size={13} className="mt-0.5 shrink-0" aria-hidden />
            )}
            {analysis.message}
          </p>
        )}
      </div>

      <fieldset className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-brand-border p-3">
        <legend className="flex items-center gap-1.5 px-1 text-sm font-semibold text-brand-text">
          Información fiscal
          <InfoHint text="Con estos datos el sistema sabe qué retenciones aplicar cuando le pagues a este proveedor. Si no estás seguro, pregúntale al proveedor o a tu contador." />
        </legend>

        <Select
          label="¿Dónde paga impuestos?"
          name="tax_residence"
          value={residence}
          onChange={(e) => setResidence(e.target.value)}
          info={FIELD_HINTS.taxResidence}
        >
          <option value="DO">República Dominicana</option>
          <option value="EXTRANJERO">En el extranjero</option>
        </Select>

        {foreign ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select label="País" name="country_code" defaultValue={defaults.country_code ?? ""} required>
              <option value="" disabled>
                Selecciona…
              </option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Input
              label="Identificación fiscal extranjera"
              name="foreign_tax_id"
              defaultValue={defaults.foreign_tax_id ?? ""}
              placeholder="Ej. EIN, NIF, RFC…"
            />
            <input type="hidden" name="id_type" value="EXTRANJERO" />
            <input type="hidden" name="supplier_kind" value={kind} />
            <input type="hidden" name="fiscal_condition" value={condition} />
            <input type="hidden" name="e_issuer" value="NO" />
            <p className="text-xs text-brand-muted sm:col-span-2">
              Los pagos al exterior pueden llevar retenciones especiales: el sistema los marcará para revisión.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Select
                label="Tipo de proveedor"
                name="supplier_kind"
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value);
                  setTouched((t) => ({ ...t, kind: true }));
                }}
                info={FIELD_HINTS.supplierKind}
              >
                <option value="">Sin definir</option>
                {SUPPLIER_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {SUPPLIER_KIND_LABELS[k]}
                  </option>
                ))}
              </Select>
              <Select
                label="Condición fiscal"
                name="fiscal_condition"
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                info={FIELD_HINTS.fiscalCondition}
              >
                <option value="">Sin definir</option>
                {FISCAL_CONDITIONS.map((c) => (
                  <option key={c} value={c}>
                    {FISCAL_CONDITION_LABELS[c]}
                  </option>
                ))}
              </Select>
              <Select
                label="Tipo de identificación"
                name="id_type"
                value={idType}
                onChange={(e) => {
                  setIdType(e.target.value);
                  setTouched((t) => ({ ...t, idType: true }));
                }}
              >
                <option value="">Sin definir</option>
                {ID_TYPES.filter((t) => t !== "EXTRANJERO").map((t) => (
                  <option key={t} value={t}>
                    {ID_TYPE_LABELS[t]}
                  </option>
                ))}
              </Select>
              <Select
                label="¿Emite factura electrónica (e-CF)?"
                name="e_issuer"
                defaultValue={defaults.e_issuer ?? "NO_CONFIRMADO"}
                info={FIELD_HINTS.eIssuer}
              >
                {E_ISSUER_VALUES.map((v) => (
                  <option key={v} value={v}>
                    {E_ISSUER_LABELS[v]}
                  </option>
                ))}
              </Select>
            </div>
            {missing && (
              <p className="flex items-start gap-1.5 rounded-[var(--radius-md)] bg-brand-warning-bg px-3 py-2 text-xs text-brand-text">
                <TriangleAlert size={13} className="mt-0.5 shrink-0 text-brand-warning" aria-hidden />
                Sin tipo de proveedor y condición fiscal, el sistema no podrá calcular las retenciones de sus gastos (te
                avisará cuando registres uno).
              </p>
            )}
          </>
        )}
      </fieldset>
    </div>
  );
}
