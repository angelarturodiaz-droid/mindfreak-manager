"use client";

import { useState, useTransition } from "react";
import { FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { toast } from "@/components/ui/toaster";
import { formatMoney } from "@/lib/utils/money";
import { todayISO } from "@/lib/utils/dates";
import { testFiscalRulesAction, type RuleTestInput } from "@/features/fiscal/rule-actions";
import { DOCUMENT_TYPES } from "@/features/fiscal/rule-schema";
import { FISCAL_CONDITIONS, FISCAL_CONDITION_LABELS, SUPPLIER_KINDS, SUPPLIER_KIND_LABELS } from "@/features/suppliers/fiscal";

type Result = Awaited<ReturnType<typeof testFiscalRulesAction>>;

const STATUS_TEXT: Record<string, string> = {
  APPLIED: "Se aplican retenciones",
  NO_RETENTION: "Sin retención",
  REVIEW: "Requiere revisión",
  BLOCKED: "Bloqueado",
  NO_RULE: "Sin regla",
  MISSING_DATA: "Faltan datos",
  NO_SUPPLIER: "Sin proveedor",
};

/** "Probar reglas": simula una operación y muestra qué regla gana y por qué. */
export function RuleTester({ classifications }: { classifications: { id: string; name: string; is_active: boolean }[] }) {
  const [input, setInput] = useState<RuleTestInput>({
    supplier_kind: "PERSONA_FISICA",
    fiscal_condition: "REGISTRADO",
    tax_residence: "DO",
    e_issuer: "NO",
    fiscal_classification_id: "",
    document_type: "B01",
    date: todayISO(),
    subtotal: 100000,
    itbis_percent: 18,
  });
  const [result, setResult] = useState<Result | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (patch: Partial<RuleTestInput>) => setInput((v) => ({ ...v, ...patch }));

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Select label="Dónde paga impuestos" value={input.tax_residence} onChange={(e) => set({ tax_residence: e.target.value })}>
          <option value="DO">República Dominicana</option>
          <option value="EXTRANJERO">Extranjero</option>
        </Select>
        <Select label="Tipo de proveedor" value={input.supplier_kind} onChange={(e) => set({ supplier_kind: e.target.value })}>
          <option value="">Sin definir</option>
          {SUPPLIER_KINDS.map((k) => (
            <option key={k} value={k}>
              {SUPPLIER_KIND_LABELS[k]}
            </option>
          ))}
        </Select>
        <Select label="Condición fiscal" value={input.fiscal_condition} onChange={(e) => set({ fiscal_condition: e.target.value })}>
          <option value="">Sin definir</option>
          {FISCAL_CONDITIONS.map((c) => (
            <option key={c} value={c}>
              {FISCAL_CONDITION_LABELS[c]}
            </option>
          ))}
        </Select>
        <Select label="Clasificación del servicio" value={input.fiscal_classification_id} onChange={(e) => set({ fiscal_classification_id: e.target.value })}>
          <option value="">Sin clasificación</option>
          {classifications.filter((c) => c.is_active).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select label="Comprobante" value={input.document_type} onChange={(e) => set({ document_type: e.target.value })}>
          {DOCUMENT_TYPES.map((d) => (
            <option key={d.code} value={d.code}>
              {d.label}
            </option>
          ))}
        </Select>
        <Select label="¿Emite e-CF?" value={input.e_issuer} onChange={(e) => set({ e_issuer: e.target.value })}>
          <option value="SI">Sí</option>
          <option value="NO">No</option>
          <option value="NO_CONFIRMADO">No confirmado</option>
        </Select>
        <Input label="Fecha de la operación" type="date" value={input.date} onChange={(e) => set({ date: e.target.value })} />
        <Input label="Subtotal (RD$)" type="number" min="0" value={input.subtotal} onChange={(e) => set({ subtotal: Number(e.target.value) })} />
        <Input label="ITBIS (%)" type="number" min="0" value={input.itbis_percent} onChange={(e) => set({ itbis_percent: Number(e.target.value) })} />
      </div>
      <div>
        <Button
          type="button"
          variant="secondary"
          icon={<FlaskConical size={14} />}
          loading={pending}
          hint="Simula un pago con estos datos y te dice qué regla aplicaría y cuánto se retendría. No guarda nada."
          onClick={() =>
            startTransition(async () => {
              try {
                setResult(await testFiscalRulesAction(input));
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "No se pudo probar.");
              }
            })
          }
        >
          Probar
        </Button>
      </div>
      {result && (
        <div className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-brand-border p-4 text-sm">
          <p className="font-semibold text-brand-text">
            {STATUS_TEXT[result.status] ?? result.status}
            {result.rule ? ` · Regla: ${result.rule.name} (v${result.rule.version})` : ""}
          </p>
          <p className="text-brand-muted">{result.message}</p>
          {result.status === "APPLIED" && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
              <div><dt className="text-xs text-brand-muted">ISR retenido</dt><dd className="font-medium tabular-nums">{formatMoney(result.isrWithheld)}</dd></div>
              <div><dt className="text-xs text-brand-muted">ITBIS retenido</dt><dd className="font-medium tabular-nums">{formatMoney(result.itbisWithheld)}</dd></div>
              <div><dt className="text-xs text-brand-muted">Total retenido</dt><dd className="font-medium tabular-nums">{formatMoney(result.totalWithheld)}</dd></div>
              <div><dt className="text-xs text-brand-muted">Neto a pagar</dt><dd className="font-semibold tabular-nums text-brand-text">{formatMoney(result.netPayable)}</dd></div>
            </dl>
          )}
          <p className="text-xs text-brand-muted">{result.explanation}</p>
          {result.candidateNames.length > 1 && (
            <p className="text-xs text-brand-muted">También coincidían (ganó la primera): {result.candidateNames.join(" · ")}</p>
          )}
        </div>
      )}
    </div>
  );
}
